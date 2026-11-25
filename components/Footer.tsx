'use client';
import { useState } from 'react';
import Link from 'next/link';

export default function Footer() {
  const [email, setEmail] = useState('');
  const [state, setState] = useState<'idle' | 'error' | 'done'>('idle');

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    // Not connected to a mailing provider yet.
    setState(/^\S+@\S+\.\S+$/.test(email) ? 'done' : 'error');
  };

  return (
    <footer id="footer" className="relative overflow-hidden bg-charcoal px-[5vw] pb-10 pt-[14vh] text-ivory">
      <p className="font-display max-w-[16ch] text-[clamp(32px,4.4vw,72px)] leading-[1.02] text-ivory/90">
        Honour the pause between breath and beauty.
      </p>

      <div className="mt-[10vh] grid gap-12 md:grid-cols-[1.2fr_1fr_1fr]">
        <form onSubmit={submit} noValidate className="max-w-[420px]">
          <label htmlFor="nl" className="text-[13px] text-ivory/70">Letters from VELUNE, rarely and slowly.</label>
          <div className="mt-4 flex border-b border-ivory/30 focus-within:border-clay">
            <input id="nl" type="email" value={email} onChange={(e) => { setEmail(e.target.value); setState('idle'); }}
                   placeholder="Your email" className="w-full bg-transparent py-3 text-[14px] outline-none placeholder:text-ivory/40" />
            <button className="text-[13px] tracking-[0.06em] hover:text-clay">Subscribe</button>
          </div>
          <p className="mt-2 h-4 text-[12px] text-ivory/60" role="status">
            {state === 'error' && 'Enter a valid email address.'}
            {state === 'done' && 'Thank you. Newsletter sending is not connected yet.'}
          </p>
        </form>

        <nav className="flex flex-col gap-3 text-[14px]" aria-label="Footer">
          {[['Shop', '/shop'], ['Rituals', '/rituals'], ['About', '/about']].map(([l, h]) => (
            <Link key={h} href={h} className="w-fit text-ivory/80 hover:text-clay">{l}</Link>
          ))}
        </nav>
        <div className="flex flex-col gap-3 text-[14px] text-ivory/80">
          <a href="mailto:care@example.com" className="w-fit hover:text-clay">Customer support</a>
          <a href="#" className="w-fit hover:text-clay">Instagram</a>
          <a href="#" className="w-fit hover:text-clay">Pinterest</a>
        </div>
      </div>

      <div className="font-display mt-[12vh] select-none text-center text-[22vw] leading-[0.8] tracking-[0.04em] text-ivory/[0.07]">VELUNE</div>

      <div className="mt-8 flex flex-wrap justify-between gap-4 text-[12px] text-ivory/50">
        <span>© {new Date().getFullYear()} VELUNE</span>
        <span className="flex gap-6"><a href="#" className="hover:text-ivory">Privacy</a><a href="#" className="hover:text-ivory">Terms</a></span>
      </div>
    </footer>
  );
}
