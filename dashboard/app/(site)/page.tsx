import { Hero, TriCards } from "@/components/site/hero";
import { StatsBar } from "@/components/site/stats";
import { Flow, FeatureRows, Modules, ProblemStrip, FaqPreview, ClosingCta } from "@/components/site/sections";
import { RoiCalculator } from "@/components/site/roi";

/* The company homepage.

   Order follows what a clinic owner needs to decide, not what we want to say:
   what this is → what it runs on → why it matters → what it costs them today →
   how it works → the product itself → what it would save → the rest of the
   system → the questions everyone asks → the ask. */
export default function HomePage() {
  return (
    <>
      <Hero />
      <TriCards />
      <StatsBar />
      <ProblemStrip />
      <Flow />
      <FeatureRows />
      <RoiCalculator />
      <Modules />
      <FaqPreview />
      <ClosingCta />
    </>
  );
}
