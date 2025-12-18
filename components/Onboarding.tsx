
import React, { useState } from 'react';

interface OnboardingProps {
  onComplete: () => void;
}

const STEPS = [
  {
    icon: "✊",
    title: "凝聚之力",
    desc: "在镜头前紧握拳头，魔法粒子将受到感召，汇聚成一颗璀璨的圣诞树。",
    color: "from-emerald-500/20 to-emerald-900/20"
  },
  {
    icon: "🖐",
    title: "星尘释放",
    desc: "张开五指，让圣诞树化作漫天繁星，随你的手势在空中翩翩起舞。",
    color: "from-amber-500/20 to-amber-900/20"
  },
  {
    icon: "👌",
    title: "捕捉记忆",
    desc: "拇指与食指轻轻捏合，即可从星群中抓取并放大浮动的美好回忆。",
    color: "from-red-500/20 to-red-900/20"
  }
];

export const Onboarding: React.FC<OnboardingProps> = ({ onComplete }) => {
  const [step, setStep] = useState(0);

  const next = () => {
    if (step < STEPS.length - 1) {
      setStep(step + 1);
    } else {
      onComplete();
    }
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 backdrop-blur-2xl">
      <div className="relative w-full max-w-lg p-12 text-center">
        {/* Decorative Background Elements */}
        <div className={`absolute inset-0 -z-10 bg-gradient-to-br ${STEPS[step].color} rounded-full blur-[100px] transition-all duration-1000`} />
        
        <div className="mb-12 animate-bounce">
          <span className="text-8xl drop-shadow-[0_0_30px_rgba(255,255,255,0.4)]">
            {STEPS[step].icon}
          </span>
        </div>

        <h2 className="text-3xl font-serif text-amber-200 mb-6 tracking-widest animate-pulse">
          {STEPS[step].title}
        </h2>
        
        <p className="text-gray-300 leading-relaxed mb-12 text-sm font-light tracking-wide h-20">
          {STEPS[step].desc}
        </p>

        <div className="flex flex-col items-center gap-6">
          <button 
            onClick={next}
            className="group relative px-12 py-3 bg-transparent border border-amber-500/50 hover:border-amber-400 transition-all active:scale-95"
          >
            <div className="absolute inset-0 bg-amber-500/5 group-hover:bg-amber-500/10" />
            <span className="relative text-amber-400 font-bold tracking-[0.4em] uppercase text-xs">
              {step < STEPS.length - 1 ? "下一步" : "步入魔法"}
            </span>
          </button>

          <div className="flex gap-2">
            {STEPS.map((_, i) => (
              <div 
                key={i} 
                className={`w-1.5 h-1.5 rounded-full transition-all duration-500 ${i === step ? 'w-6 bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.6)]' : 'bg-gray-700'}`}
              />
            ))}
          </div>
        </div>

        <button 
          onClick={onComplete}
          className="absolute top-0 right-0 p-4 text-gray-500 hover:text-white text-xs tracking-tighter transition-colors"
        >
          SKIP
        </button>
      </div>
    </div>
  );
};
