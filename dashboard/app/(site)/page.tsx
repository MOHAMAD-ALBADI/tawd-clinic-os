import { ProblemStrip, Flow, Proof, ClosingCta } from "@/components/site/home-sections";
import { Hero } from "@/components/site/hero";
import { Channels, FeatureRows, Modules, FaqPreview } from "@/components/site/feature-rows";
import { RoiCalculator } from "@/components/site/roi";

/* Nine sections, not six.

   The first two versions had a hero, four cards, four numbers and a button, and
   read as unfinished because it was. What was missing was the spine every real
   landing page has: one large, readable product screen per claim, sides
   alternating, with the evidence beside it. */
export default function HomePage() {
  return (
    <>
      <Hero />
      <Channels />
      <ProblemStrip />
      <Flow />
      <FeatureRows />
      <RoiCalculator />
      <Proof />
      <Modules />
      <FaqPreview />
      <ClosingCta />
    </>
  );
}
