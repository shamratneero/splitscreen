import { Brand } from "@/components/bill-chrome";

export default function Home() {
  return <main className="welcome"><Brand /><div className="welcome-content"><p className="eyebrow">FOR THE WHOLE TABLE</p><h1>Good food.<br />Fair splits.</h1><p className="welcome-description">Your share, made simple. Open your host’s link or scan their QR code to get started.</p><ol className="welcome-steps"><li><span>01</span>Choose what you had</li><li><span>02</span>Check your share</li><li><span>03</span>Pay your host</li></ol><p className="welcome-note">No account. No download. Just your share.</p></div><footer className="welcome-footer">Hosting the table? <a href="https://addasplit-host.vercel.app">Create a split <span aria-hidden="true">↗</span></a></footer></main>;
}
