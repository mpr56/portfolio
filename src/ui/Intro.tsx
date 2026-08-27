import { useProgress } from "@react-three/drei";
import { useEffect, useState } from "react";
import { useScene } from "../store";

export function Intro() {
  const { progress, active } = useProgress();
  const entered = useScene((s) => s.entered);
  const enter = useScene((s) => s.enter);
  const [gone, setGone] = useState(false);

  useEffect(() => {
    if (entered || active || progress < 100) return;
    const t = setTimeout(enter, 220);
    return () => clearTimeout(t);
  }, [active, progress, entered, enter]);

  useEffect(() => {
    if (!entered) return;
    const t = setTimeout(() => setGone(true), 1000);
    return () => clearTimeout(t);
  }, [entered]);

  if (gone) return null;

  return (
    <div className={`intro ${entered ? "is-gone" : ""}`} aria-hidden={entered}>
      <div className="intro__inner">
        <p className="intro__mark">Manav P.</p>
        <div className="intro__bar">
          <span
            style={{ transform: `scaleX(${Math.min(progress, 100) / 100})` }}
          />
        </div>
        <p style={{ textAlign: "center" }}>
          Explore by interacting with the objects.
          <br /> You can interact with (almost) everything!
          <br /> (website starts muted)
        </p>
      </div>
    </div>
  );
}
