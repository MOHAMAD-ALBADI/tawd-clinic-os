import { Hero, ProblemStrip, Flow, Proof, Depth, ClosingCta } from "@/components/site/home-sections";

/* The finance screen used to appear again here, under the stats. It now leads
   the hero in 3D, so a second flat copy of it a page later only weakened both. */
export default function HomePage() {
  return (
    <>
      <Hero />
      <ProblemStrip />
      <Flow />
      <Proof />
      <Depth />
      <ClosingCta />
    </>
  );
}
