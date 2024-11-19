'use client'
import CryptoMarquee from "./components/CryptoMarquee";
import CryptoPortfolio from "./components/CryptoPortfolio";

export default function Home() {
  return (
    <div className="flex flex-col min-h-screen bg-[#0a0a0a]">
      <CryptoMarquee />
      <div className="flex-1 flex flex-col items-center justify-center p-8">
        <CryptoPortfolio />
      </div>
    </div>
  );
}
