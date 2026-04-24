import { useEffect } from "react";

interface SEOProps {
  title?: string;
  description?: string;
  url?: string;
}

export const useSEO = ({ title, description, url }: SEOProps) => {
  useEffect(() => {
    document.title = title
      ? `${title} | AgroLoopCI`
      : "AgroLoopCI — Zéro gaspillage, Impact maximum";

    const desc = document.querySelector('meta[name="description"]');
    if (desc && description) desc.setAttribute("content", description);

    const ogTitle = document.querySelector('meta[property="og:title"]');
    const ogDesc = document.querySelector('meta[property="og:description"]');
    const ogUrl = document.querySelector('meta[property="og:url"]');
    const twTitle = document.querySelector('meta[name="twitter:title"]');
    const twDesc = document.querySelector('meta[name="twitter:description"]');
    const twUrl = document.querySelector('meta[name="twitter:url"]');
    const canonical = document.querySelector('link[rel="canonical"]');

    if (ogTitle && title) ogTitle.setAttribute("content", `${title} | AgroLoopCI`);
    if (ogDesc && description) ogDesc.setAttribute("content", description);
    if (ogUrl && url) ogUrl.setAttribute("content", `https://www.agroloopci.ci${url}`);
    if (twTitle && title) twTitle.setAttribute("content", `${title} | AgroLoopCI`);
    if (twDesc && description) twDesc.setAttribute("content", description);
    if (twUrl && url) twUrl.setAttribute("content", `https://www.agroloopci.ci${url}`);
    if (canonical && url) canonical.setAttribute("href", `https://www.agroloopci.ci${url}`);
  }, [title, description, url]);
};
