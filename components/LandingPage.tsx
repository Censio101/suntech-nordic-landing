"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowRight,
  Car,
  Check,
  ChevronLeft,
  Mail,
  Phone,
  ShieldCheck,
  Sun,
  Thermometer,
} from "lucide-react";
import { trackLead } from "@/lib/meta-pixel";
import {
  attemptPartialNotifyOnUnload,
  ownerNotifyKey,
  setOwnerNotifyStatus,
  type PartialNotifyFormState,
} from "@/lib/abandon-notify";
import {
  migrateLeadData,
  saveLeadDataFromWebhook,
  saveLeadDraft,
} from "@/lib/lead-session-storage";
import {
  formatPhoneDisplay,
  normalizePhoneForWebhook,
  stripPhoneDigits,
} from "@/lib/phone";

type CustomerType = "Privat" | "Erhverv" | "";
type JaNej = "Ja" | "Nej" | "";

type Lead = {
  name: string;
  phone: string;
  email: string;
  address: string;
  city: string;
  postal: string;
  type: CustomerType;
  company: string;
  consumption: string;
  consumptionUnknown: boolean;
  hasHeatPump: JaNej;
  hasEv: JaNej;
  hasSolar: JaNej;
};

const portrait = "/alex-suntech-nordic_2395eab6.png";

const hasValidEmail = (value: string) =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
const hasValidPhone = (value: string) => stripPhoneDigits(value).length === 8;
const hasValidPostal = (value: string) => /^\d{4}$/.test(value);
const hasValidName = (value: string) => value.trim().length >= 2;

const reviews = [
  {
    title: "Et troværdigt firma",
    text: "Et firma der reagerer hurtig ved henvendelse, og i den forbindelse kom med kompetent og let forståelige forklaringer på ens spørgsmål.",
    author: "Niels Henrik Bech",
    avatar: null as string | null,
  },
  {
    title: "Har været helt igennem tilfreds med…",
    text: "Har været helt igennem tilfreds med hele forløbet kan kun sige god for Tobias der er bare styr det hele 😊",
    author: "Zenia Hagemann",
    avatar: null,
  },
  {
    title: "Super godt oplevelse og service kan…",
    text: "Super godt oplevelse og service kan anbefales",
    author: "Johnny Vestergaard",
    avatar: "https://user-images.trustpilot.com/69ee3b77791905042611ba37/73x73.png",
  },
  {
    title: "Efter at jeg havde bestilt mit solcelle…",
    text: "Efter at jeg havde bestilt mit solcelle anlæg fik jeg det leveret til tiden og alle aktører og håndværkere mødte op og arbejde til anlægget var færdig og klar til brug.",
    author: "Claus Helweg",
    avatar: null,
  },
  {
    title: "Stor tommel op",
    text: "Fin service og humør fra første kontakt. Hurtig levering samt dygtige og glade montører udførte et rigtig godt stykke arbejde.",
    author: "Martin",
    avatar: null,
  },
  {
    title: "Suntech Nordic var fra dag 1 meget…",
    text: "Suntech Nordic var fra dag 1 meget seriøs. De vidste godt at de skal gøre det så godt for os lige fra starten.",
    author: "Glenn Lundsberg",
    avatar: "https://user-images.trustpilot.com/666d80ebc485c061fa21cf12/73x73.png",
  },
  {
    title: "Solcelleanlæg og service fra SunTech Nordic fungere upåklageligt",
    text: "Har købt et komplet solcelleanlæg med montering ved SunTech Nordic. Tømreren og elektrikerne leverede et meget pænt stykke arbejde, og det har været nemt at komme i kontakt med Alex.",
    author: "Lars",
    avatar: null,
  },
  {
    title: "Det bedste firma",
    text: "Helt igennem fantastisk oplevelse. Hurtig levering og opstart og altid parat til at hjælpe hele vejen igennem.",
    author: "Gita Glargaard",
    avatar: "https://user-images.trustpilot.com/5f3644b784ac578f33fe10fd/73x73.png",
  },
];

const workImages = [
  { src: "/01-rooftop-installation_9a0132a7.jpg", aspect: "4 / 3" },
  { src: "/02-alex-battery-landscape_efd64275.png", aspect: "4 / 3" },
  { src: "/03-solar-roof-home_d458e453.jpg", aspect: "4 / 3" },
  { src: "/04-energy-installation_eeae0157.jpg", aspect: "3 / 4" },
  { src: "/06-solar-home_3e10e8a3.jpg", aspect: "4 / 3" },
  { src: "/07-panel-mounting_74636228.jpg", aspect: "3 / 4" },
];

const emptyLead: Lead = {
  name: "",
  phone: "",
  email: "",
  address: "",
  city: "",
  postal: "",
  type: "",
  company: "",
  consumption: "",
  consumptionUnknown: false,
  hasHeatPump: "",
  hasSolar: "",
  hasEv: "",
};

function mapCustomerType(type: CustomerType): "privat" | "erhverv" | undefined {
  if (type === "Privat") return "privat";
  if (type === "Erhverv") return "erhverv";
  return undefined;
}

function kwhForbrug(lead: Lead): string {
  if (lead.consumptionUnknown) return "ved ikke";
  return lead.consumption.trim();
}

async function postStepWebhook(
  step: 1 | 2 | 3 | 4,
  data: Record<string, unknown>
): Promise<{ ok: boolean; error?: string }> {
  const payload = {
    ...data,
    ...(typeof data.telefon === "string"
      ? { telefon: normalizePhoneForWebhook(data.telefon) }
      : {}),
  };
  const res = await fetch("/api/submit", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ step, ...payload }),
  });
  const json = (await res.json()) as { error?: string };
  if (!res.ok) {
    return { ok: false, error: json.error ?? "Noget gik galt. Prøv igen." };
  }
  return { ok: true };
}

export default function LandingPage() {
  const [step, setStep] = useState(1);
  const [sent, setSent] = useState(false);
  const [lead, setLead] = useState<Lead>(emptyLead);
  const [showErrors, setShowErrors] = useState(false);
  const [leadId, setLeadId] = useState<number | null>(null);
  const [fbclid, setFbclid] = useState<string | undefined>();
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const sessionKeyRef = useRef(Date.now());
  const formStateRef = useRef<PartialNotifyFormState>({
    step: 1,
    draftStep1: {},
    step1Data: undefined,
    step2Data: undefined,
    step3Data: undefined,
    leadId: null,
    fbclid: undefined,
    isSubmitting: false,
    sessionKey: sessionKeyRef.current,
  });

  const mappedType = mapCustomerType(lead.type);
  const kwhValue = kwhForbrug(lead);

  const missingFields = useMemo(() => {
    if (step === 1) {
      return [
        !hasValidName(lead.name) && "name",
        !hasValidPhone(lead.phone) && "phone",
        !hasValidEmail(lead.email) && "email",
      ].filter(Boolean) as string[];
    }
    if (step === 2) {
      return [
        lead.address.trim().length < 3 && "address",
        !lead.city.trim() && "city",
        !hasValidPostal(lead.postal) && "postal",
      ].filter(Boolean) as string[];
    }
    if (step === 3) {
      return [
        !lead.type && "type",
        lead.type === "Erhverv" && !lead.company.trim() && "company",
        !lead.consumptionUnknown && !lead.consumption && "consumption",
      ].filter(Boolean) as string[];
    }
    return [
      !lead.hasHeatPump && "hasHeatPump",
      !lead.hasSolar && "hasSolar",
      !lead.hasEv && "hasEv",
    ].filter(Boolean) as string[];
  }, [lead, step]);

  const valid = missingFields.length === 0;
  const isMissing = (field: string) => showErrors && missingFields.includes(field);
  const errorMessage = (field: string) => {
    const messages: Record<string, string> = {
      type: "Vælg privat eller erhverv.",
      hasHeatPump: "Vælg Ja eller Nej.",
      hasEv: "Vælg Ja eller Nej.",
      hasSolar: "Vælg Ja eller Nej.",
    };
    return messages[field] ?? "Du mangler at udfylde dette felt.";
  };

  function update<K extends keyof Lead>(key: K, value: Lead[K]) {
    setLead((current) => ({ ...current, [key]: value }));
  }

  useEffect(() => {
    const fb = new URLSearchParams(window.location.search).get("fbclid");
    if (fb) setFbclid(fb);
  }, []);

  useEffect(() => {
    if (step === 1) {
      saveLeadDraft(
        sessionKeyRef.current,
        {
          navn: lead.name,
          telefon: stripPhoneDigits(lead.phone),
          email: lead.email,
        },
        fbclid
      );
    }
  }, [lead.name, lead.phone, lead.email, step, fbclid]);

  useEffect(() => {
    const type = mapCustomerType(lead.type);
    formStateRef.current = {
      step: sent ? 5 : step,
      draftStep1: {
        navn: lead.name,
        telefon: stripPhoneDigits(lead.phone),
        email: lead.email,
      },
      step1Data:
        leadId !== null
          ? {
              navn: lead.name,
              telefon: stripPhoneDigits(lead.phone),
              email: lead.email,
            }
          : undefined,
      step2Data:
        step >= 3
          ? { adresse: lead.address, postnummer: lead.postal, by: lead.city }
          : undefined,
      step3Data:
        step >= 4 && type
          ? {
              type,
              firmanavn: lead.company,
              kwh_forbrug: kwhForbrug(lead),
            }
          : undefined,
      leadId,
      fbclid,
      isSubmitting,
      sessionKey: leadId ?? sessionKeyRef.current,
    };
  }, [step, sent, lead, leadId, fbclid, isSubmitting]);

  useEffect(() => {
    const onPageHide = () => {
      attemptPartialNotifyOnUnload(formStateRef.current);
    };
    window.addEventListener("pagehide", onPageHide);
    return () => window.removeEventListener("pagehide", onPageHide);
  }, []);

  const webhookMeta = (id: number) => ({
    leadId: id,
    ...(fbclid ? { fbclid } : {}),
  });

  const contactPayload = () => ({
    navn: lead.name.trim(),
    telefon: stripPhoneDigits(lead.phone),
    email: lead.email.trim(),
  });

  const addressPayload = () => ({
    adresse: lead.address.trim(),
    postnummer: lead.postal,
    by: lead.city.trim(),
  });

  async function handleNext() {
    if (!valid) {
      setShowErrors(true);
      return;
    }
    setShowErrors(false);
    setError(null);

    if (step === 1) {
      setIsSubmitting(true);
      const id = Date.now();
      setLeadId(id);
      migrateLeadData(sessionKeyRef.current, id);
      const payload = { ...contactPayload(), ...webhookMeta(id) };
      const result = await postStepWebhook(1, payload);
      setIsSubmitting(false);
      if (!result.ok) {
        setError(result.error ?? "Noget gik galt. Prøv igen.");
        return;
      }
      saveLeadDataFromWebhook(id, 1, payload);
      setStep(2);
      return;
    }

    if (leadId === null) return;

    if (step === 2) {
      setIsSubmitting(true);
      const payload = {
        ...contactPayload(),
        ...addressPayload(),
        ...webhookMeta(leadId),
      };
      const result = await postStepWebhook(2, payload);
      setIsSubmitting(false);
      if (!result.ok) {
        setError(result.error ?? "Noget gik galt. Prøv igen.");
        return;
      }
      saveLeadDataFromWebhook(leadId, 2, payload);
      setStep(3);
      return;
    }

    if (step === 3) {
      if (!mappedType) return;
      setIsSubmitting(true);
      const payload = {
        ...contactPayload(),
        ...addressPayload(),
        type: mappedType,
        ...(mappedType === "erhverv" ? { firmanavn: lead.company.trim() } : {}),
        kwh_forbrug: kwhValue,
        ...webhookMeta(leadId),
      };
      const result = await postStepWebhook(3, payload);
      setIsSubmitting(false);
      if (!result.ok) {
        setError(result.error ?? "Noget gik galt. Prøv igen.");
        return;
      }
      saveLeadDataFromWebhook(leadId, 3, payload);
      setStep(4);
      return;
    }

    if (step === 4) {
      if (!mappedType || lead.hasEv === "" || lead.hasSolar === "" || lead.hasHeatPump === "") {
        return;
      }
      setIsSubmitting(true);
      setOwnerNotifyStatus(leadId, "completing");
      const payload = {
        ...contactPayload(),
        ...addressPayload(),
        type: mappedType,
        ...(mappedType === "erhverv" ? { firmanavn: lead.company.trim() } : {}),
        kwh_forbrug: kwhValue,
        har_elbil: lead.hasEv,
        hasSolar: lead.hasSolar,
        hasHeatPump: lead.hasHeatPump,
        ...webhookMeta(leadId),
      };
      try {
        const result = await postStepWebhook(4, payload);
        if (!result.ok) {
          sessionStorage.removeItem(ownerNotifyKey(leadId));
          setError(result.error ?? "Noget gik galt. Prøv igen.");
          return;
        }
        setOwnerNotifyStatus(leadId, "completed");
        await trackLead({
          navn: lead.name,
          email: lead.email,
          telefon: stripPhoneDigits(lead.phone),
          by: lead.city,
          postnummer: lead.postal,
          type: mappedType,
        });
        setSent(true);
      } catch {
        setError("Noget gik galt. Prøv igen.");
      } finally {
        setIsSubmitting(false);
      }
    }
  }

  function reset() {
    setLead(emptyLead);
    setStep(1);
    setSent(false);
    setShowErrors(false);
    setError(null);
    setLeadId(null);
    setIsSubmitting(false);
    sessionKeyRef.current = Date.now();
  }

  return (
    <main className={`page-shell ${sent ? "success-state" : ""}`}>
      <div className="ambient ambient-a" aria-hidden="true" />
      <div className="ambient ambient-b" aria-hidden="true" />

      <header className={`topbar ${sent ? "success-topbar" : ""}`}>
        <a className="brand" href="https://suntechnordic.dk/" target="_blank" rel="noreferrer">
          <img
            src="https://suntechnordic.dk/wp-content/uploads/2025/05/Logo-SuntechNordic-White.png"
            alt="SunTech Nordic"
          />
        </a>
      </header>

      {!sent && (
        <section className="hero">
          <div className="alex-feature-card">
            <div className="alex-profile">
              <div className="alex-photo">
                <img src={portrait} alt="Alex, ejer af SunTech Nordic" />
              </div>
              <div>
                <p>Alex Lee</p>
                <span>Ejer af SunTech Nordic</span>
              </div>
            </div>
            <div className="feature-copy">
              <h1>
                Få en professionel og
                <br />
                <em>uforpligtende vurdering</em>
              </h1>
              <p className="hero-text">af din energiløsning</p>
            </div>
          </div>
        </section>
      )}

      <section
        className={`lead-panel ${sent ? "success-panel" : `form-step-${step}`}`}
        aria-label="Forespørg en vurdering"
      >
        {sent ? (
          <div className="success-view">
            <div className="success-alex-photo">
              <img src={portrait} alt="Alex Lee, ejer af SunTech Nordic" />
            </div>
            <h2>
              Tak for din
              <br />
              <em>forespørgsel!</em>
            </h2>
            <p>Vi har modtaget dine oplysninger.</p>
            <div className="confirmation">
              <p>
                Du bliver kontaktet hurtigst muligt. Hvis det haster, er du velkommen
                til at ringe eller sende en mail.
              </p>
              <div className="success-contacts" aria-label="Kontakt SunTech Nordic">
                <a href="tel:+4532278787">
                  <Phone size={18} />
                  32 27 87 87
                </a>
                <a href="mailto:kontakt@suntechnordic.dk">
                  <Mail size={18} />
                  kontakt@suntechnordic.dk
                </a>
              </div>
            </div>
            <a
              className="submit-button"
              href="https://suntechnordic.dk/"
              target="_blank"
              rel="noreferrer"
            >
              BESØG VORES HJEMMESIDE <ArrowRight size={17} />
            </a>
            <button className="text-button" type="button" onClick={reset}>
              Lav en ny forespørgsel
            </button>
          </div>
        ) : (
          <>
            {error && (
              <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
                {error}
              </div>
            )}

            {step === 1 && (
              <div className="form-fields entered compact-step">
                <label className={isMissing("name") ? "has-error" : ""}>
                  <span>FULDE NAVN *</span>
                  <input
                    aria-invalid={isMissing("name")}
                    value={lead.name}
                    onChange={(event) => update("name", event.target.value.replace(/\d/g, ""))}
                    placeholder="Fx Anna Jensen"
                    autoComplete="name"
                  />
                  {isMissing("name") && (
                    <small className="field-error">{errorMessage("name")}</small>
                  )}
                </label>
                <div className="two-columns">
                  <label className={isMissing("phone") ? "has-error" : ""}>
                    <span>TELEFONNUMMER *</span>
                    <input
                      aria-invalid={isMissing("phone")}
                      value={formatPhoneDisplay(lead.phone)}
                      onChange={(event) => update("phone", stripPhoneDigits(event.target.value))}
                      placeholder="Fx 41 15 23 77"
                      autoComplete="tel"
                      inputMode="numeric"
                      maxLength={11}
                    />
                    {isMissing("phone") && (
                      <small className="field-error">{errorMessage("phone")}</small>
                    )}
                  </label>
                  <label className={isMissing("email") ? "has-error" : ""}>
                    <span>E-MAIL *</span>
                    <input
                      aria-invalid={isMissing("email")}
                      value={lead.email}
                      onChange={(event) => update("email", event.target.value)}
                      placeholder="Fx anna@email.dk"
                      autoComplete="email"
                      type="email"
                    />
                    {isMissing("email") && (
                      <small className="field-error">{errorMessage("email")}</small>
                    )}
                  </label>
                </div>
              </div>
            )}

            {step === 2 && (
              <div className="form-fields entered address-step">
                <label className={isMissing("address") ? "has-error" : ""}>
                  <span>ADRESSE *</span>
                  <input
                    aria-invalid={isMissing("address")}
                    value={lead.address}
                    onChange={(event) => update("address", event.target.value)}
                    placeholder="Vejnavn og nummer"
                    autoComplete="street-address"
                  />
                  {isMissing("address") && (
                    <small className="field-error">{errorMessage("address")}</small>
                  )}
                </label>
                <div className="two-columns city-postal">
                  <label className={isMissing("city") ? "has-error" : ""}>
                    <span>BY *</span>
                    <input
                      aria-invalid={isMissing("city")}
                      value={lead.city}
                      onChange={(event) => update("city", event.target.value.replace(/\d/g, ""))}
                      placeholder="Fx Storvorde"
                      autoComplete="address-level2"
                    />
                    {isMissing("city") && (
                      <small className="field-error">{errorMessage("city")}</small>
                    )}
                  </label>
                  <label className={isMissing("postal") ? "has-error" : ""}>
                    <span>POSTNUMMER *</span>
                    <input
                      aria-invalid={isMissing("postal")}
                      value={lead.postal}
                      onChange={(event) =>
                        update("postal", event.target.value.replace(/\D/g, "").slice(0, 4))
                      }
                      placeholder="Fx 9280"
                      autoComplete="postal-code"
                      inputMode="numeric"
                      maxLength={4}
                    />
                    {isMissing("postal") && (
                      <small className="field-error">{errorMessage("postal")}</small>
                    )}
                  </label>
                </div>
              </div>
            )}

            {step === 3 && (
              <div className="selection-content entered battery-step">
                <div className={isMissing("type") ? "choice-field has-error" : "choice-field"}>
                  <p className="field-question">Er løsningen til privat eller erhverv?</p>
                  <div className="segmented">
                    {(["Privat", "Erhverv"] as const).map((type) => (
                      <button
                        type="button"
                        key={type}
                        className={lead.type === type ? "selected" : ""}
                        onClick={() => {
                          update("type", type);
                          if (type === "Privat") update("company", "");
                        }}
                      >
                        {lead.type === type && <Check size={14} />} {type}
                      </button>
                    ))}
                  </div>
                  {isMissing("type") && (
                    <small className="field-error">{errorMessage("type")}</small>
                  )}
                </div>
                {lead.type === "Erhverv" && (
                  <label className={isMissing("company") ? "company-field has-error" : "company-field"}>
                    <span>VIRKSOMHEDSNAVN *</span>
                    <input
                      aria-invalid={isMissing("company")}
                      value={lead.company}
                      onChange={(event) => update("company", event.target.value)}
                      placeholder="Virksomhedens navn"
                      autoComplete="organization"
                    />
                    {isMissing("company") && (
                      <small className="field-error">{errorMessage("company")}</small>
                    )}
                  </label>
                )}

                <div className="battery-questions">
                  <label
                    className={
                      isMissing("consumption")
                        ? "question-block consumption-field has-error"
                        : "question-block consumption-field"
                    }
                  >
                    <span>VED DU HVOR MEGET STRØM DU BRUGER OM ÅRET?</span>
                    <div className="consumption-row">
                      <div className="consumption-input">
                        <input
                          aria-invalid={isMissing("consumption")}
                          value={lead.consumption}
                          onChange={(event) =>
                            setLead((current) => ({
                              ...current,
                              consumption: event.target.value.replace(/\D/g, ""),
                              consumptionUnknown: false,
                            }))
                          }
                          placeholder="Fx 6.000"
                          inputMode="numeric"
                          pattern="[0-9]*"
                        />
                        <span>kWh</span>
                      </div>
                      <button
                        type="button"
                        className={lead.consumptionUnknown ? "selected" : ""}
                        onClick={() =>
                          setLead((current) => ({
                            ...current,
                            consumption: "",
                            consumptionUnknown: true,
                          }))
                        }
                      >
                        Ved ikke
                      </button>
                    </div>
                    {isMissing("consumption") && (
                      <small className="field-error">{errorMessage("consumption")}</small>
                    )}
                  </label>
                </div>
              </div>
            )}

            {step === 4 && (
              <div className="selection-content entered features-step">
                <p className="field-question">Hvilke energiløsninger har du allerede?</p>
                <div className="yesno-grid">
                  <div
                    className={`feature-choice ${lead.hasHeatPump ? "selected" : ""} ${
                      isMissing("hasHeatPump") ? "has-error" : ""
                    }`}
                  >
                    <div className="feature-choice-copy">
                      <span className="feature-choice-icon">
                        <Thermometer size={20} />
                      </span>
                      <div>
                        <p>Har du en varmepumpe?</p>
                      </div>
                    </div>
                    <div className="yesno-buttons" role="group" aria-label="Har du en varmepumpe?">
                      {(["Ja", "Nej"] as const).map((option) => (
                        <button
                          type="button"
                          key={option}
                          className={lead.hasHeatPump === option ? "selected" : ""}
                          onClick={() => update("hasHeatPump", option)}
                        >
                          {lead.hasHeatPump === option && <Check size={14} />} {option}
                        </button>
                      ))}
                    </div>
                    {isMissing("hasHeatPump") && (
                      <small className="field-error">{errorMessage("hasHeatPump")}</small>
                    )}
                  </div>
                  <div
                    className={`feature-choice ${lead.hasEv ? "selected" : ""} ${
                      isMissing("hasEv") ? "has-error" : ""
                    }`}
                  >
                    <div className="feature-choice-copy">
                      <span className="feature-choice-icon">
                        <Car size={20} />
                      </span>
                      <div>
                        <p>Har du en elbil?</p>
                      </div>
                    </div>
                    <div className="yesno-buttons" role="group" aria-label="Har du en elbil?">
                      {(["Ja", "Nej"] as const).map((option) => (
                        <button
                          type="button"
                          key={option}
                          className={lead.hasEv === option ? "selected" : ""}
                          onClick={() => update("hasEv", option)}
                        >
                          {lead.hasEv === option && <Check size={14} />} {option}
                        </button>
                      ))}
                    </div>
                    {isMissing("hasEv") && (
                      <small className="field-error">{errorMessage("hasEv")}</small>
                    )}
                  </div>
                  <div
                    className={`feature-choice ${lead.hasSolar ? "selected" : ""} ${
                      isMissing("hasSolar") ? "has-error" : ""
                    }`}
                  >
                    <div className="feature-choice-copy">
                      <span className="feature-choice-icon">
                        <Sun size={20} />
                      </span>
                      <div>
                        <p>Har du solceller?</p>
                      </div>
                    </div>
                    <div className="yesno-buttons" role="group" aria-label="Har du solceller?">
                      {(["Ja", "Nej"] as const).map((option) => (
                        <button
                          type="button"
                          key={option}
                          className={lead.hasSolar === option ? "selected" : ""}
                          onClick={() => update("hasSolar", option)}
                        >
                          {lead.hasSolar === option && <Check size={14} />} {option}
                        </button>
                      ))}
                    </div>
                    {isMissing("hasSolar") && (
                      <small className="field-error">{errorMessage("hasSolar")}</small>
                    )}
                  </div>
                </div>
              </div>
            )}

            <div className={`panel-actions ${step > 1 ? "has-back" : ""}`}>
              <button
                className="submit-button assessment-cta"
                type="button"
                onClick={() => void handleNext()}
                disabled={isSubmitting}
              >
                <span>
                  {isSubmitting
                    ? "Sender..."
                    : "Få en professionel og uforpligtende vurdering"}
                </span>{" "}
                <ArrowRight size={18} />
              </button>
              {step > 1 && (
                <button
                  className="back"
                  type="button"
                  onClick={() => {
                    setShowErrors(false);
                    setError(null);
                    setStep(step - 1);
                  }}
                >
                  <ChevronLeft size={17} /> Tilbage
                </button>
              )}
            </div>
            <p className="privacy">
              <ShieldCheck size={13} /> Dine oplysninger behandles fortroligt.
            </p>
          </>
        )}
      </section>

      <div className="reassurance">
        <span>
          <Check size={14} /> Personlig rådgivning
        </span>
        <span>
          <Check size={14} /> Ingen binding
        </span>
        <span>
          <Check size={14} /> Solceller, batterier & varmepumper
        </span>
      </div>

      <section className="trustpilot-section" aria-labelledby="trustpilot-heading">
        <div className="trustpilot-topline">
          <div>
            <p className="eyebrow">ANMELDELSER FRA TRUSTPILOT</p>
            <h2 id="trustpilot-heading">Kun 5 stjerner på Trustpilot.</h2>
          </div>
          <a
            className="trustpilot-score"
            href="https://dk.trustpilot.com/review/suntechnordic.dk?stars=5"
            target="_blank"
            rel="noreferrer"
            aria-label="Læs SunTech Nordics anmeldelser på Trustpilot"
          >
            <div className="trustpilot-stars" aria-hidden="true">
              <i>★</i>
              <i>★</i>
              <i>★</i>
              <i>★</i>
              <i className="partial">★</i>
            </div>
            <span>
              <b>Trustpilot</b>
            </span>
          </a>
        </div>
        <div className="review-marquee" aria-label="Udvalgte Trustpilot-anmeldelser">
          <div className="review-track">
            {[false, true].map((duplicate) => (
              <div
                className="review-set"
                aria-hidden={duplicate}
                key={duplicate ? "duplicate" : "original"}
              >
                {reviews.map((review) => (
                  <article
                    className="review-card"
                    key={`${review.title}-${review.author}-${duplicate ? "copy" : "source"}`}
                  >
                    <div className="review-stars" aria-label="5 ud af 5 stjerner">
                      ★★★★★
                    </div>
                    <h3>{review.title}</h3>
                    <blockquote>“{review.text}”</blockquote>
                    <div className="reviewer">
                      {review.avatar ? (
                        <img
                          src={review.avatar}
                          alt={duplicate ? "" : `Profilbillede for ${review.author}`}
                        />
                      ) : (
                        <span className="reviewer-initials" aria-hidden="true">
                          {review.author
                            .split(" ")
                            .map((word) => word[0])
                            .join("")
                            .slice(0, 2)}
                        </span>
                      )}
                      <p>
                        <strong>{review.author}</strong>
                        <span>Trustpilot-anmelder</span>
                      </p>
                    </div>
                  </article>
                ))}
              </div>
            ))}
          </div>
        </div>
        <div className="trustpilot-verified">
          <span>Verificeret af</span>
          <b>★ Trustpilot</b>
        </div>
      </section>

      <section className="work-gallery" aria-label="SunTech Nordic arbejde">
        <div className="work-track">
          {[false, true].map((duplicate) => (
            <div className="work-set" aria-hidden={duplicate} key={duplicate ? "duplicate" : "original"}>
              {workImages.map((image, index) => (
                <figure
                  className="work-card"
                  style={{ aspectRatio: image.aspect }}
                  key={`${image.src}-${index}-${duplicate ? "copy" : "source"}`}
                >
                  <img src={image.src} alt={duplicate ? "" : "SunTech Nordic installation"} />
                </figure>
              ))}
            </div>
          ))}
        </div>
      </section>

      <footer className="site-footer">
        <div className="footer-credit">
          <p>UDVIKLET AF CENSIO</p>
          <p>CVR 45593320</p>
        </div>
        <div className="footer-company">
          <p>SUNTECH NORDIC</p>
          <p>BAKKEVÆNGET 15 · 9280 STORVORDE</p>
        </div>
      </footer>
    </main>
  );
}
