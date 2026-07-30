import { Hero, ProblemStrip, Flow, Proof, Depth, ClosingCta } from "@/components/site/home-sections";
import { ScreenHighlight } from "@/components/site/screens";

export default function HomePage() {
  return (
    <>
      <Hero />
      <ProblemStrip />
      <Flow />
      <Proof />
      {/* The screen the numbers above came from, immediately after them — so the
          claim and its source are read together rather than a page apart. */}
      <ScreenHighlight />
      <Depth />
      <ClosingCta />
    </>
  );
}
