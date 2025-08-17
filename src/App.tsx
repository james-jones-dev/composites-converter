import { useMemo, useState } from "react";

/** ---- Constants (exact enough for shop work) ---- */
const M2_PER_YD2 = 0.9144 * 0.9144;             // 0.83612736
const M2_PER_FT2 = 0.3048 * 0.3048;             // 0.09290304
const G_PER_OZ = 28.349523125;
const LB_TO_G = 453.59237;
const IN_TO_M = 0.0254;
const MM_TO_M = 0.001;
const CM_TO_M = 0.01;
const M_TO_YD = 1 / 0.9144;
const GAL_TO_ML = 3785.411784;
const QT_TO_ML = 946.352946;
const OZFL_TO_ML = 29.5735295625;
const L_TO_ML = 1000;

/** ---- Textile areal weight conversions ---- */
function gsmToOzPerYd2(gsm: number): number {
  return gsm * (1 / (G_PER_OZ / M2_PER_YD2)); // ≈ gsm * 0.029493525
}
function ozPerYd2ToGsm(ozPerYd2: number): number {
  return ozPerYd2 * (G_PER_OZ / M2_PER_YD2);  // ≈ oz/yd² * 33.9057475
}
function gsmToOzPerFt2(gsm: number): number {
  return gsm * (1 / (G_PER_OZ / M2_PER_FT2)); // ≈ gsm * 0.0032770583
}
function ozPerFt2ToGsm(ozPerFt2: number): number {
  return ozPerFt2 * (G_PER_OZ / M2_PER_FT2);  // ≈ oz/ft² * 305.1517273
}

function fmt(n: number | string, digits = 6): string {
  if (n === "" || Number.isNaN(Number(n))) return "";
  const x = typeof n === "number" ? n : Number(n);
  return Number.parseFloat(x.toPrecision(digits)).toString();
}

/** ---- UI ---- */
type Tab = "textile" | "roll" | "catalyst";

export default function App() {
  const [tab, setTab] = useState<Tab>("textile");

  return (
    <main style={{ maxWidth: 780, margin: "2rem auto", padding: 16, fontFamily: "system-ui" }}>
      <h1>Composites Converter</h1>
      <nav style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        <button onClick={() => setTab("textile")}>Textile Areal Weight</button>
        <button onClick={() => setTab("roll")}>Roll Length</button>
        <button onClick={() => setTab("catalyst")}>Catalyst % & Volumes</button>
      </nav>

      <section style={{ border: "1px solid #ccc", borderRadius: 8, padding: 16 }}>
        {tab === "textile" && <TextilePane />}
        {tab === "roll" && <RollPane />}
        {tab === "catalyst" && <CatalystPane />}
      </section>
    </main>
  );
}

/** ---------- 1) Textile areal weight pane ---------- */
function TextilePane() {
  const [gsm, setGsm] = useState("200");
  const [ozYd2, setOzYd2] = useState("");
  const [ozFt2, setOzFt2] = useState("");

  // derive others from whichever changed last; simplest is to compute all from gsm and also allow reverse.
  // Here we compute dynamically based on current inputs (if provided).
  const derived = useMemo(() => {
    const g = Number(gsm);
    const oy = ozYd2 ? Number(ozYd2) : undefined;
    const of = ozFt2 ? Number(ozFt2) : undefined;

    if (!Number.isNaN(g) && g > 0 && !ozYd2 && !ozFt2) {
      return {
        from: "gsm",
        gsm: g,
        oy: gsmToOzPerYd2(g),
        of: gsmToOzPerFt2(g),
      };
    }
    if (oy !== undefined && !Number.isNaN(oy) && !ozFt2) {
      const g2 = ozPerYd2ToGsm(oy);
      return { from: "oy", gsm: g2, oy, of: gsmToOzPerFt2(g2) };
    }
    if (of !== undefined && !Number.isNaN(of)) {
      const g3 = ozPerFt2ToGsm(of);
      return { from: "of", gsm: g3, oy: gsmToOzPerYd2(g3), of };
    }
    // fallback: compute from gsm
    const gF = Number.isNaN(g) ? 0 : g;
    return { from: "gsm", gsm: gF, oy: gsmToOzPerYd2(gF), of: gsmToOzPerFt2(gF) };
  }, [gsm, ozYd2, ozFt2]);

  return (
    <div style={{ display: "grid", gap: 12 }}>
      <p><strong>Convert GSM ⇄ oz/yd² ⇄ oz/ft²</strong></p>
      <Row label="GSM">
        <input value={gsm} onChange={(e) => { setGsm(e.target.value); setOzYd2(""); setOzFt2(""); }} inputMode="decimal" />
      </Row>
      <Row label="oz / yd²">
        <input value={ozYd2} onChange={(e) => { setOzYd2(e.target.value); setOzFt2(""); }} inputMode="decimal" placeholder={fmt(derived.oy)} />
      </Row>
      <Row label="oz / ft²">
        <input value={ozFt2} onChange={(e) => { setOzFt2(e.target.value); setOzYd2(""); }} inputMode="decimal" placeholder={fmt(derived.of)} />
      </Row>

      <Summary>
        <li>{fmt(derived.gsm)} gsm ≈ {fmt(derived.oy)} oz/yd² ≈ {fmt(derived.of)} oz/ft²</li>
      </Summary>
    </div>
  );
}

/** ---------- 2) Roll length pane ---------- */
function RollPane() {
  // Inputs
  const [areal, setAreal] = useState("200");      // gsm
  const [rollWeight, setRollWeight] = useState("25"); // roll weight value
  const [rollWeightUnit, setRollWeightUnit] = useState<"kg" | "lb">("kg");
  const [width, setWidth] = useState("50");       // width value
  const [widthUnit, setWidthUnit] = useState<"in" | "mm" | "cm" | "m">("in");

  const out = useMemo(() => {
    const gsm = Number(areal);
    const rw = Number(rollWeight);
    const wv = Number(width);
    if ([gsm, rw, wv].some((x) => Number.isNaN(x) || x <= 0)) return null;

    const mass_g = rollWeightUnit === "kg" ? rw * 1000 : rw * LB_TO_G;
    const width_m =
      widthUnit === "in" ? wv * IN_TO_M :
      widthUnit === "mm" ? wv * MM_TO_M :
      widthUnit === "cm" ? wv * CM_TO_M : wv;

    // Area (m²) = mass_g / gsm ; Length (m) = Area / width_m
    const area_m2 = mass_g / gsm;
    const length_m = area_m2 / width_m;
    const length_yd = length_m * M_TO_YD;

    return { area_m2, length_m, length_yd };
  }, [areal, rollWeight, rollWeightUnit, width, widthUnit]);

  return (
    <div style={{ display: "grid", gap: 12 }}>
      <p><strong>Linear yards/meters from roll weight, areal weight, and width</strong></p>

      <Row label="Areal weight (gsm)">
        <input value={areal} onChange={(e) => setAreal(e.target.value)} inputMode="decimal" />
      </Row>

      <Row label="Roll weight">
        <div style={{ display: "grid", gridTemplateColumns: "1fr 100px", gap: 8 }}>
          <input value={rollWeight} onChange={(e) => setRollWeight(e.target.value)} inputMode="decimal" />
          <select value={rollWeightUnit} onChange={(e) => setRollWeightUnit(e.target.value as any)}>
            <option value="kg">kg</option>
            <option value="lb">lb</option>
          </select>
        </div>
      </Row>

      <Row label="Roll width">
        <div style={{ display: "grid", gridTemplateColumns: "1fr 100px", gap: 8 }}>
          <input value={width} onChange={(e) => setWidth(e.target.value)} inputMode="decimal" />
          <select value={widthUnit} onChange={(e) => setWidthUnit(e.target.value as any)}>
            <option value="in">in</option>
            <option value="mm">mm</option>
            <option value="cm">cm</option>
            <option value="m">m</option>
          </select>
        </div>
      </Row>

      {out && (
        <Summary>
          <li>Area: {fmt(out.area_m2)} m²</li>
          <li>Length: {fmt(out.length_yd)} yd ({fmt(out.length_m)} m)</li>
        </Summary>
      )}
    </div>
  );
}

/** ---------- 3) Catalyst percentage & volumes pane ---------- */
function CatalystPane() {
  const [percent, setPercent] = useState("1.5");              // % v/v
  const [resinVal, setResinVal] = useState("1");              // amount of resin
  const [resinUnit, setResinUnit] = useState<"gal"|"qt"|"L"|"fl_oz">("gal");

  const calc = useMemo(() => {
    const p = Number(percent);
    const v = Number(resinVal);
    if (Number.isNaN(p) || Number.isNaN(v) || v <= 0) return null;

    const resin_mL =
      resinUnit === "gal" ? v * GAL_TO_ML :
      resinUnit === "qt"  ? v * QT_TO_ML  :
      resinUnit === "L"   ? v * L_TO_ML   :
                            v * OZFL_TO_ML;

    const cat_mL = resin_mL * (p / 100);
    const cat_cc = cat_mL; // 1 mL = 1 cc
    const cat_fl_oz = cat_mL / OZFL_TO_ML;

    // Normalized dosing rates for reference (per gallon at the same %)
    const cc_per_gal = GAL_TO_ML * (p / 100);     // ≈ 37.8541 * p
    const oz_per_gal = cc_per_gal / OZFL_TO_ML;   // ≈ 1.2809 * p

    return { cat_mL, cat_cc, cat_fl_oz, cc_per_gal, oz_per_gal };
  }, [percent, resinVal, resinUnit]);

  return (
    <div style={{ display: "grid", gap: 12 }}>
      <p><strong>Catalyst by volume</strong> (shop-friendly cc/gal and oz/gal)</p>

      <Row label="Catalyst % (v/v)">
        <input value={percent} onChange={(e) => setPercent(e.target.value)} inputMode="decimal" />
      </Row>

      <Row label="Resin amount">
        <div style={{ display: "grid", gridTemplateColumns: "1fr 120px", gap: 8 }}>
          <input value={resinVal} onChange={(e) => setResinVal(e.target.value)} inputMode="decimal" />
          <select value={resinUnit} onChange={(e) => setResinUnit(e.target.value as any)}>
            <option value="gal">gal</option>
            <option value="qt">qt</option>
            <option value="L">L</option>
            <option value="fl_oz">fl oz</option>
          </select>
        </div>
      </Row>

      {calc && (
        <>
          <Summary>
            <li>For {resinVal} {resinUnit} at {percent}% → {fmt(calc.cat_cc)} cc ({fmt(calc.cat_fl_oz)} fl oz)</li>
          </Summary>
          <small style={{ color: "#666" }}>
            Reference dosing rate (normalized): {fmt(calc.cc_per_gal)} cc/gal ≈ {fmt(calc.oz_per_gal)} oz/gal
          </small>
        </>
      )}
    </div>
  );
}

/** ---- Small layout helpers ---- */
function Row(props: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: "grid", gridTemplateColumns: "180px 1fr", alignItems: "center", gap: 12 }}>
      <span style={{ color: "#444" }}>{props.label}</span>
      <div>{props.children}</div>
    </label>
  );
}
function Summary(props: { children: React.ReactNode }) {
  return (
    <ul style={{ margin: "8px 0 0 0", paddingLeft: 18, lineHeight: 1.6 }}>
      {props.children}
    </ul>
  );
}