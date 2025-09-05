import { useMemo, useState } from "react";

/** ---- Constants ---- */
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

/** ---- Helpers ---- */
function gsmToOzPerYd2(gsm: number) { return gsm * (1 / (G_PER_OZ / M2_PER_YD2)); }
function ozPerYd2ToGsm(ozPerYd2: number) { return ozPerYd2 * (G_PER_OZ / M2_PER_YD2); }
function gsmToOzPerFt2(gsm: number) { return gsm * (1 / (G_PER_OZ / M2_PER_FT2)); }
function ozPerFt2ToGsm(ozPerFt2: number) { return ozPerFt2 * (G_PER_OZ / M2_PER_FT2); }

function clampNum(s: string) {
  if (s.trim() === "") return NaN;
  const n = Number(s);
  return Number.isFinite(n) ? n : NaN;
}
function fmt(n: number | string, decimals: number, trim = true): string {
  if (n === "" || Number.isNaN(Number(n))) return "";
  const x = typeof n === "number" ? n : Number(n);
  const fixed = x.toFixed(decimals);
  return trim ? parseFloat(fixed).toString() : fixed;
}

/** ---- UI ---- */
type Tab = "textile" | "roll" | "catalyst";

export default function App() {
  const [tab, setTab] = useState<Tab>("textile");
  const [decimals, setDecimals] = useState<number>(3);

  return (
    <main style={{ maxWidth: 820, margin: "0 auto", padding: 16, fontFamily: "system-ui" }}>
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <h1 style={{ margin: 0 }}>Composites Converter</h1>
        <label className="row" style={{ gridTemplateColumns: "auto auto" }}>
          <span style={{ color: "#444" }}>Precision</span>
          <select value={decimals} onChange={(e) => setDecimals(parseInt(e.target.value, 10))}>
            {[0,1,2,3,4,5,6].map(d => <option key={d} value={d}>{d} decimals</option>)}
          </select>
        </label>
      </header>

      <nav style={{ display: "flex", gap: 8, margin: "12px 0 16px" }}>
        <button onClick={() => setTab("textile")} disabled={tab==="textile"}>Textile Areal Weight</button>
        <button onClick={() => setTab("roll")} disabled={tab==="roll"}>Roll Length</button>
        <button onClick={() => setTab("catalyst")} disabled={tab==="catalyst"}>Catalyst % & Volumes</button>
      </nav>

      <section style={{ border: "1px solid #ccc", borderRadius: 8, padding: 16 }}>
        {tab === "textile" && <TextilePane decimals={decimals} />}
        {tab === "roll" && <RollPane decimals={decimals} />}
        {tab === "catalyst" && <CatalystPane decimals={decimals} />}
      </section>
    </main>
  );
}

/** ---------- 1) Textile: bidirectional GSM ⇄ oz/yd² ⇄ oz/ft² ---------- */
function TextilePane({ decimals }: { decimals: number }) {
  const [source, setSource] = useState<"gsm" | "oy" | "of">("gsm");
  const [gsmStr, setGsmStr] = useState("200");
  const [oyStr, setOyStr] = useState("");  // oz/yd²
  const [ofStr, setOfStr] = useState("");  // oz/ft²

  const values = useMemo(() => {
    let gsm = NaN;
    if (source === "gsm") gsm = clampNum(gsmStr);
    if (source === "oy")  { const oy = clampNum(oyStr); if (Number.isFinite(oy)) gsm = ozPerYd2ToGsm(oy); }
    if (source === "of")  { const of = clampNum(ofStr); if (Number.isFinite(of)) gsm = ozPerFt2ToGsm(of); }
    if (!Number.isFinite(gsm)) return { gsm: NaN, oy: NaN, of: NaN };
    return { gsm, oy: gsmToOzPerYd2(gsm), of: gsmToOzPerFt2(gsm) };
  }, [source, gsmStr, oyStr, ofStr]);

  return (
    <div style={{ display: "grid", gap: 12 }}>
      <p><strong>Convert gsm ⇄ oz/yd² ⇄ oz/ft²</strong></p>
      <Row label="gsm">
        <input
          value={source === "gsm" ? gsmStr : fmt(values.gsm, decimals)}
          onChange={(e) => { setSource("gsm"); setGsmStr(e.target.value); }}
          inputMode="decimal"
        />
      </Row>
      <Row label="oz / yd²">
        <input
          value={source === "oy" ? oyStr : fmt(values.oy, decimals)}
          onChange={(e) => { setSource("oy"); setOyStr(e.target.value); }}
          inputMode="decimal"
        />
      </Row>
      <Row label="oz / ft²">
        <input
          value={source === "of" ? ofStr : fmt(values.of, decimals)}
          onChange={(e) => { setSource("of"); setOfStr(e.target.value); }}
          inputMode="decimal"
        />
      </Row>
      <Summary>
        <p>{fmt(values.gsm, decimals)} gsm ≈ {fmt(values.oy, decimals)} oz/yd² ≈ {fmt(values.of, decimals)} oz/ft²</p>
      </Summary>
    </div>
  );
}

/** ---------- 2) Roll length ---------- */
function RollPane({ decimals }: { decimals: number }) {
  const [areal, setAreal] = useState("200");      // gsm
  const [rollWeight, setRollWeight] = useState("25");
  const [rollWeightUnit, setRollWeightUnit] = useState<"kg" | "lb">("kg");
  const [width, setWidth] = useState("50");
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
        <div className="input-grid">
          <input value={rollWeight} onChange={(e) => setRollWeight(e.target.value)} inputMode="decimal" />
          <select value={rollWeightUnit} onChange={(e) => setRollWeightUnit(e.target.value as any)}>
            <option value="kg">kg</option>
            <option value="lb">lb</option>
          </select>
        </div>
      </Row>
      <Row label="Roll width">
        <div className="input-grid">
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
          <li>Area: {fmt(out.area_m2, decimals)} m²</li>
          <li>Length: {fmt(out.length_yd, decimals)} yd ({fmt(out.length_m, decimals)} m)</li>
        </Summary>
      )}
    </div>
  );
}

/** ---------- 3) Catalyst % & volumes ---------- */
function CatalystPane({ decimals }: { decimals: number }) {
  const [percent, setPercent] = useState("1.5");
  const [resinVal, setResinVal] = useState("1");
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
    const cat_cc = cat_mL;
    const cat_fl_oz = cat_mL / OZFL_TO_ML;

    const cc_per_gal = GAL_TO_ML * (p / 100);
    const oz_per_gal = cc_per_gal / OZFL_TO_ML;

    return { cat_mL, cat_cc, cat_fl_oz, cc_per_gal, oz_per_gal };
  }, [percent, resinVal, resinUnit]);

  return (
    <div style={{ display: "grid", gap: 12 }}>
      <p><strong>Catalyst by volume</strong></p>
      <Row label="Catalyst % (v/v)">
        <input value={percent} onChange={(e) => setPercent(e.target.value)} inputMode="decimal" />
      </Row>
      <Row label="Resin amount">
        <div className="input-grid">
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
            <li>For {resinVal} {resinUnit} at {percent}% → {fmt(calc.cat_cc, decimals)} cc ({fmt(calc.cat_fl_oz, decimals)} fl oz)</li>
          </Summary>
          <small style={{ color: "#666" }}>
            Reference dose: {fmt(calc.cc_per_gal, decimals)} cc/gal ≈ {fmt(calc.oz_per_gal, decimals)} oz/gal
          </small>
        </>
      )}
    </div>
  );
}

/** ---- Layout helpers ---- */
function Row(props: { label: string; children: React.ReactNode }) {
  return (
    <label className="row">
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
