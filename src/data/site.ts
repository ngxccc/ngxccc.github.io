export interface AuthorConfig {
  name: string;
  handle: string;
  location: string;
  email: string;
  github: string;
  linkedin: string;
}

export interface SiteConfig {
  title: string;
  url: string;
  description: string;
  tagline: string;
  author: AuthorConfig;
}

export const siteConfig: SiteConfig = {
  title: "Tran Van Ngoc",
  url: "https://ngxccc.github.io",
  description:
    "Personal website, technical writing, and software engineering projects by Tran Van Ngoc (ngxccc).",
  tagline:
    "Software developer focused on backend architecture, concurrency control, and Linux. This site is my personal space for technical notes and software projects.",
  author: {
    name: "Tran Van Ngoc",
    handle: "ngxccc",
    location: "Ho Chi Minh City, Vietnam",
    email: "ngocshintrann@gmail.com",
    github: "https://github.com/ngxccc",
    linkedin: "https://linkedin.com/in/ngxc",
  },
};
