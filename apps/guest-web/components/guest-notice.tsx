import { Brand } from "./bill-chrome";

export function GuestNotice({ title, description, retryHref }: { title: string; description: string; retryHref?: string }) {
  return <main className="welcome"><Brand /><div className="welcome-content recovery-content"><p className="eyebrow">LET’S GET YOU BACK TO THE TABLE</p><h1>{title}</h1><p className="welcome-description">{description}</p>{retryHref ? <a className="button" href={retryHref}>Try again</a> : <a className="secondary-button" href="/">Back to SplitSave</a>}</div></main>;
}
