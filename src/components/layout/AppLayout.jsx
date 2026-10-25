import Header from './Header';
import MobileNav from './MobileNav';
import Sidebar from './Sidebar';

export default function AppLayout({ route, children }) {
  const skipToContent = () => {
    document.getElementById('main-content')?.focus();
  };

  return (
    <div className="min-h-screen">
      <button
        type="button"
        onClick={skipToContent}
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[70] focus:rounded-lg focus:bg-brand-600 focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-white"
      >
        Skip to content
      </button>

      <Sidebar route={route} />

      <div className="min-w-0 lg:pl-64">
        <Header />
        <main
          id="main-content"
          tabIndex={-1}
          className="mx-auto w-full max-w-[1400px] px-4 pb-28 pt-6 outline-none sm:px-6 lg:px-8 lg:pb-10"
        >
          {children}
        </main>
      </div>

      <MobileNav route={route} />
    </div>
  );
}