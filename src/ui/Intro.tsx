import { useProgress } from "@react-three/drei";
import { useEffect, useState } from "react";
import { useScene } from "../store";
import { IntroFrame } from "./IntroFrame";

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

  return <IntroFrame progress={progress} gone={entered} />;
}
