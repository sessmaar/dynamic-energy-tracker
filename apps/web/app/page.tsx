import Link from "next/link";

/**
 * Dense Matrix Landing Page.
 * Beautiful, lightweight, consumer-facing homepage.
 */
export default function LandingPage() {
  return (
    <div className="min-h-screen bg-bg text-fg font-body-md antialiased selection:bg-accent/20 selection:text-accent flex flex-col">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 w-full z-50 bg-white/80 backdrop-blur-xl border-b border-border/30 shadow-sm">
        <div className="max-w-[1280px] mx-auto px-6 h-16 flex justify-between items-center">
          <div className="flex items-center gap-8">
            <span className="font-display font-bold text-2xl tracking-tight text-fg">
              Dense Matrix
            </span>
            <div className="hidden md:flex items-center gap-6">
              <a className="font-body text-sm text-muted hover:text-accent transition-colors" href="#product">Product</a>
              <a className="font-body text-sm text-muted hover:text-accent transition-colors" href="#science">Science</a>
              <Link className="font-body text-sm text-muted hover:text-accent transition-colors" href="/demo">Engine Sandbox</Link>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <Link href="/sign-in" className="font-body text-sm font-medium text-muted hover:text-accent transition-colors">
              Log in
            </Link>
            <Link href="/sign-in" className="bg-fg text-white px-5 py-2 rounded-full font-body text-sm font-medium hover:bg-accent transition-colors shadow-sm">
              Get Started
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <main className="flex-1 pt-32 pb-24 hero-gradient relative overflow-hidden">
        <div className="max-w-[1280px] mx-auto px-6 grid md:grid-cols-2 gap-12 items-center">
          <div className="space-y-8">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-accent/10 border border-accent/20 text-accent font-mono text-xs">
              <span className="w-2 h-2 rounded-full bg-secondary-container animate-pulse"></span>
              Now in open beta
            </div>
            <h1 className="font-display text-5xl md:text-6xl font-bold tracking-tight text-fg leading-tight">
              Calm Precision.<br />
              <span className="text-accent">Metabolic Truth.</span>
            </h1>
            <p className="font-body text-lg text-muted max-w-lg leading-relaxed">
              Dense Matrix employs Bayesian Convergence to continuously audit your metabolism. 
              Say goodbye to static TDEE estimators and step into the clinical reality of your physiology.
            </p>
            <div className="flex items-center gap-4 pt-4">
              <Link href="/sign-in" className="bg-fg text-white px-6 py-3 rounded-full font-body text-sm font-medium hover:bg-accent transition-all shadow-md hover:shadow-lg flex items-center gap-2">
                Start your audit
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 5l7 7m0 0l-7 7m7-7H3" />
                </svg>
              </Link>
              <Link href="/demo" className="glass-panel px-6 py-3 rounded-full font-body text-sm font-medium text-fg hover:text-accent transition-all">
                View sandbox data
              </Link>
            </div>
          </div>

          {/* Interactive Visual Card */}
          <div className="relative w-full h-[380px] glass-panel rounded-3xl p-6 flex flex-col justify-between overflow-hidden">
            <div className="absolute inset-0 z-0 opacity-10 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-accent to-transparent"></div>
            <div className="relative z-10 flex justify-between items-start">
              <div>
                <p className="font-mono text-xs text-muted uppercase tracking-wider">Dynamic TDEE Trajectory</p>
                <p className="font-mono text-4xl font-bold text-fg mt-2">2,485 <span className="text-sm text-muted font-normal">kcal/day</span></p>
              </div>
              <div className="bg-white/95 backdrop-blur rounded-full px-3 py-1 flex items-center gap-1.5 shadow-sm border border-border/30">
                <span className="w-2.5 h-2.5 rounded-full bg-secondary-container"></span>
                <span className="font-mono text-xs text-fg font-medium">Model Converged</span>
              </div>
            </div>

            {/* Sparkline overlay */}
            <div className="w-full h-24 relative flex items-end">
              <svg className="w-full h-full text-accent" preserveAspectRatio="none" viewBox="0 0 100 100">
                <defs>
                  <linearGradient id="glowGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.2" />
                    <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
                  </linearGradient>
                </defs>
                <path d="M0,80 Q25,40 50,60 T100,20 L100,100 L0,100 Z" fill="url(#glowGrad)" />
                <path d="M0,80 Q25,40 50,60 T100,20" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
              </svg>
            </div>

            <div className="relative z-10 bg-white/90 backdrop-blur rounded-2xl p-5 border border-border/30 shadow-sm">
              <div className="flex justify-between items-end mb-3">
                <span className="font-body text-xs text-muted">Statistical Confidence</span>
                <span className="font-mono text-sm font-semibold text-accent">94.2%</span>
              </div>
              <div className="w-full h-2 bg-surface-container rounded-full overflow-hidden">
                <div className="h-full bg-accent rounded-full" style={{ width: "94.2%" }}></div>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Features Grid */}
      <section id="product" className="py-24 bg-white relative">
        <div className="max-w-[1280px] mx-auto px-6">
          <div className="mb-16 text-center max-w-2xl mx-auto">
            <h2 className="font-display text-4xl font-bold text-fg mb-4">The End of Guesswork</h2>
            <p className="font-body text-muted">
              Our engine continuously refines your metabolic baseline, separating the biological signal from the noise of daily weight fluctuations.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* Bento Item 1 */}
            <div className="glass-panel rounded-3xl p-8 col-span-1 md:col-span-2 relative overflow-hidden flex flex-col justify-between h-[360px]">
              <div className="space-y-4">
                <div className="w-12 h-12 rounded-full bg-accent/5 flex items-center justify-center text-accent">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 12l3-3 3 3 4-4M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
                  </svg>
                </div>
                <h3 className="font-display text-2xl font-bold text-fg">Bayesian Convergence</h3>
                <p className="font-body text-muted max-w-md">
                  Stop chasing volatile scale weight. We use advanced statistical smoothing to find your true weight trend and precise energy expenditure over time.
                </p>
              </div>

              {/* Graphic bars */}
              <div className="bg-bg border border-border/20 rounded-2xl p-6 h-32 flex items-end gap-2 relative overflow-hidden">
                <div className="w-1/6 h-[40%] bg-border/40 rounded-t-md"></div>
                <div className="w-1/6 h-[60%] bg-border/40 rounded-t-md"></div>
                <div className="w-1/6 h-[50%] bg-border/40 rounded-t-md"></div>
                <div className="w-1/6 h-[80%] bg-accent/20 rounded-t-md"></div>
                <div className="w-1/6 h-[75%] bg-accent/40 rounded-t-md"></div>
                <div className="w-1/6 h-[90%] bg-accent rounded-t-md"></div>
                <div className="absolute inset-0 p-6 pointer-events-none">
                  <svg className="w-full h-full text-accent" preserveAspectRatio="none" viewBox="0 0 100 100">
                    <path d="M0,80 Q25,60 50,70 T100,20" fill="none" stroke="currentColor" strokeWidth="2" />
                  </svg>
                </div>
              </div>
            </div>

            {/* Bento Item 2 */}
            <div className="glass-panel rounded-3xl p-8 col-span-1 flex flex-col justify-between h-[360px]">
              <div className="space-y-4">
                <div className="w-12 h-12 rounded-full bg-secondary/5 flex items-center justify-center text-secondary">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                  </svg>
                </div>
                <h3 className="font-display text-2xl font-bold text-fg">Weekly Metabolic Audit</h3>
                <p className="font-body text-sm text-muted">
                  Every Sunday, receive a clear, authoritative report on your metabolic adaptation. We tell you exactly when to adjust calories and by how much.
                </p>
              </div>

              <div className="bg-bg border border-border/20 rounded-2xl p-5">
                <div className="flex justify-between items-center mb-2">
                  <span className="font-mono text-xs text-muted uppercase">Recommendation</span>
                  <span className="font-mono text-xs text-accent">AUDITED</span>
                </div>
                <p className="font-mono text-2xl font-semibold text-fg">-150 <span className="text-xs text-muted font-normal">kcal/day</span></p>
                <p className="font-body text-[10px] text-muted mt-1 leading-normal">
                  Metabolic adaptation detected. Deficit adjustment recommended to maintain target trajectory.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="w-full py-12 bg-surface-container border-t border-border/40 mt-auto">
        <div className="max-w-[1280px] mx-auto px-6 flex flex-col md:flex-row justify-between items-center gap-6">
          <span className="font-display font-bold text-xl text-fg">Dense Matrix</span>
          <div className="flex gap-6">
            <a className="font-mono text-xs text-muted hover:text-accent" href="#">Privacy</a>
            <a className="font-mono text-xs text-muted hover:text-accent" href="#">Terms</a>
            <a className="font-mono text-xs text-muted hover:text-accent" href="#">Science</a>
          </div>
          <span className="font-mono text-xs text-muted">
            © 2026 Dense Matrix Systems. Precise Metabolic Intelligence.
          </span>
        </div>
      </footer>
    </div>
  );
}
