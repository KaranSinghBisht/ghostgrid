import React from "react";
import ThermoMini from "./ThermoMini";
import UVMini from "./UVMini";
import EMFMini from "./EMFMini";
import SpiritMini from "./SpiritMini";
import WritingMini from "./WritingMini";
import PropMini from "./PropMini";

export type MiniKind = "thermo" | "uv" | "emf" | "spirit" | "writing" | "prop";
export type MiniResult = { success: boolean; score?: number };

export type MiniProps = {
  onComplete: (res: MiniResult) => void;
  onCancel: () => void;
};

type HostProps = {
  open: boolean;
  kind: MiniKind | null;
  onDone: (res: MiniResult) => void;
  onCancel: () => void;
};

export default function MiniHost({ open, kind, onDone, onCancel }: HostProps) {
  const [inst, setInst] = React.useState(0);
  React.useEffect(() => { if (open && kind) setInst(i => i + 1); }, [open, kind]);
  if (!open || !kind) return null;

  return (
    <div onClick={onCancel} style={{
      position:"fixed", inset:0, background:"rgba(0,0,0,.55)",
      display:"grid", placeItems:"center", zIndex:40
    }}>
      <div onClick={e=>e.stopPropagation()} style={{
        width:"min(540px, 94vw)", background:"#141414", border:"1px solid #262626",
        borderRadius:16, padding:14, boxShadow:"0 20px 60px rgba(0,0,0,.6)"
      }}>
        {kind === "thermo"  && <ThermoMini  key={`thermo-${inst}`}  onComplete={onDone} onCancel={onCancel} />}
        {kind === "uv"      && <UVMini      key={`uv-${inst}`}      onComplete={onDone} onCancel={onCancel} />}
        {kind === "emf"     && <EMFMini     key={`emf-${inst}`}     onComplete={onDone} onCancel={onCancel} />}
        {kind === "spirit"  && <SpiritMini  key={`spirit-${inst}`}  onComplete={onDone} onCancel={onCancel} />}
        {kind === "writing" && <WritingMini key={`writing-${inst}`} onComplete={onDone} onCancel={onCancel} />}
        {kind === "prop"    && <PropMini    key={`prop-${inst}`}    onComplete={onDone} onCancel={onCancel} />}
      </div>
    </div>
  );
}