import { Disciplines } from "@/components/Disciplines";
import { Footer } from "@/components/Footer";
import { Hero } from "@/components/Hero";
import { Navbar } from "@/components/Navbar";
import { Pricing } from "@/components/Pricing";
import { ClubTour } from "@/components/three/ClubTour";

export default function Home() {
  return (
    <>
      <Navbar />
      <main>
        <Hero />
        <ClubTour />
        <Disciplines />
        <Pricing />
      </main>
      <Footer />
    </>
  );
}
