import type { Engine } from "./model";
const header = String.raw`% Resume TeX starter. Fictional sample content: replace with your own facts.
% Original adaptation. Attribution and licenses: docs/templates.md
`;
export const templates: {
  id: string;
  name: string;
  description: string;
  engine: Engine;
  tags: string[];
  source: string;
}[] = [
  {
    id: "jake",
    name: "Jake's Resume",
    description: "A familiar, focused one-column technical resume.",
    engine: "pdflatex",
    tags: ["Single column", "Technical"],
    source:
      header +
      String.raw`\documentclass[letterpaper,11pt]{article}
\usepackage[margin=0.65in]{geometry}
\usepackage[T1]{fontenc}
\usepackage{lmodern,titlesec,enumitem,hyperref}
\hypersetup{colorlinks=true,urlcolor=black}
\pagestyle{empty}
\setlength{\parindent}{0pt}
\titleformat{\section}{\large\bfseries}{}{0pt}{}[\titlerule]
\setlist[itemize]{leftmargin=*,nosep}
\newcommand{\resumeItem}[1]{\item #1}
\begin{document}
\begin{center}
{\Huge\bfseries Alex Morgan}\\[5pt]
San Francisco, CA $|$ (415) 555-0100 $|$ \href{mailto:alex@example.com}{alex@example.com}\\
\href{https://github.com/alex}{github.com/alex} $|$ \href{https://linkedin.com/in/alex}{linkedin.com/in/alex}
\end{center}
\section{Experience}
\textbf{Software Engineer} \hfill Jan 2022 -- Present\\
\textit{Example Labs, San Francisco, CA}
\begin{itemize}
\resumeItem{Built a TypeScript dashboard used by 120 teammates to review service health.}
\resumeItem{Reduced API response time by 35\% through PostgreSQL query optimization.}
\resumeItem{Maintained React components and added automated tests for critical workflows.}
\end{itemize}
\section{Projects}
\textbf{Open Source Issue Tracker} $|$ TypeScript, React, Node.js
\begin{itemize}
\resumeItem{Designed a searchable issue board with keyboard navigation and accessible forms.}
\resumeItem{Documented a REST API and deployed reproducible Docker development environments.}
\end{itemize}
\section{Education}
\textbf{University of California} \hfill Sep 2017 -- May 2021\\
B.S. Computer Science
\section{Skills}
\textbf{Languages:} TypeScript, JavaScript, SQL, Python\\
\textbf{Frameworks:} React, Node.js, Next.js\\
\textbf{Tools:} PostgreSQL, Git, Docker, AWS
\end{document}
`,
  },
  {
    id: "deedy",
    name: "Deedy",
    description: "An airy two-column layout with expressive typography.",
    engine: "xelatex",
    tags: ["Two columns", "XeLaTeX"],
    source:
      header +
      String.raw`\documentclass[letterpaper,10pt]{article}
\usepackage[margin=0.65in]{geometry}
\usepackage{fontspec,xcolor,titlesec,enumitem,hyperref}
\setmainfont{TeX Gyre Heros}
\definecolor{ink}{HTML}{25364A}
\titleformat{\section}{\Large\color{ink}}{}{0pt}{}
\pagestyle{empty}\setlength{\parindent}{0pt}
\setlist[itemize]{leftmargin=*,nosep}
\begin{document}
{\fontsize{36}{42}\selectfont Alex \textbf{Morgan}}\\[6pt]
Software Engineer \hfill alex@example.com $|$ (415) 555-0100\\
San Francisco, CA \hfill github.com/alex\\[18pt]
\begin{minipage}[t]{0.31\textwidth}
\section{Education}
\textbf{University of California}\\
B.S. Computer Science\\
Sep 2017 -- May 2021
\section{Skills}
\textbf{Languages}\\
TypeScript, JavaScript\\SQL, Python\\[8pt]
\textbf{Frameworks}\\
React, Node.js, Next.js\\[8pt]
\textbf{Tools}\\
Git, Docker, AWS\\PostgreSQL
\end{minipage}\hfill
\begin{minipage}[t]{0.63\textwidth}
\section{Experience}
\textbf{Example Labs | Software Engineer}\\
Jan 2022 -- Present | San Francisco, CA
\begin{itemize}
\item Built a TypeScript dashboard used by 120 teammates to review service health.
\item Reduced API response time by 35\% through PostgreSQL query optimization.
\item Maintained React components and automated tests for critical workflows.
\end{itemize}
\section{Projects}
\textbf{Open Source Issue Tracker}\\
TypeScript, React, Node.js
\begin{itemize}
\item Designed a searchable issue board with keyboard navigation and accessible forms.
\item Documented a REST API and reproducible Docker development environments.
\end{itemize}
\end{minipage}
\end{document}
`,
  },
  {
    id: "alta",
    name: "AltaCV-style",
    description: "A confident blue accent and compact career sidebar.",
    engine: "pdflatex",
    tags: ["Two columns", "Visual"],
    source:
      header +
      String.raw`\documentclass[letterpaper,10pt]{article}
\usepackage[margin=0.7in]{geometry}
\usepackage[T1]{fontenc}
\usepackage{lmodern,xcolor,titlesec,enumitem,hyperref}
\definecolor{accent}{HTML}{315FEA}
\titleformat{\section}{\large\bfseries\color{accent}}{}{0pt}{}[\titlerule]
\pagestyle{empty}\setlength{\parindent}{0pt}
\setlist[itemize]{leftmargin=*,nosep}
\begin{document}
{\Huge\bfseries\color{accent} Alex Morgan}\\[5pt]
{\Large Software Engineer}\\[6pt]
alex@example.com $|$ (415) 555-0100 $|$ San Francisco, CA\\
github.com/alex $|$ linkedin.com/in/alex\\[14pt]
\begin{minipage}[t]{0.64\textwidth}
\section{Experience}
\textbf{Software Engineer}\\
\textcolor{accent}{Example Labs}\\
Jan 2022 -- Present
\begin{itemize}
\item Built a TypeScript dashboard used by 120 teammates to review service health.
\item Reduced API response time by 35\% through PostgreSQL query optimization.
\item Maintained React components and tests for critical workflows.
\end{itemize}
\section{Projects}
\textbf{Open Source Issue Tracker}
\begin{itemize}
\item Designed a searchable issue board with keyboard navigation and accessible forms.
\item Documented a REST API and Docker development environments.
\end{itemize}
\end{minipage}\hfill
\begin{minipage}[t]{0.30\textwidth}
\section{Skills}
TypeScript, JavaScript\\SQL, Python\\[7pt]
React, Node.js, Next.js\\[7pt]
PostgreSQL, Git\\Docker, AWS
\section{Education}
\textbf{University of California}\\
B.S. Computer Science\\
Sep 2017 -- May 2021
\end{minipage}
\end{document}
`,
  },
  {
    id: "moderncv",
    name: "moderncv",
    description: "A polished classic with a strong date column.",
    engine: "pdflatex",
    tags: ["Classic", "Professional"],
    source:
      header +
      String.raw`\documentclass[11pt,letterpaper,sans]{moderncv}
\moderncvstyle{banking}
\moderncvcolor{blue}
\usepackage[scale=0.82]{geometry}
\name{Alex}{Morgan}
\title{Software Engineer}
\address{San Francisco, CA}{}{}
\phone[mobile]{+1~415~555~0100}
\email{alex@example.com}
\homepage{github.com/alex}
\begin{document}
\makecvtitle
\section{Experience}
\cventry{Jan 2022 -- Present}{Software Engineer}{Example Labs}{San Francisco, CA}{}{\begin{itemize}
\item Built a TypeScript dashboard used by 120 teammates to review service health.
\item Reduced API response time by 35\% through PostgreSQL query optimization.
\item Maintained React components and automated tests for critical workflows.
\end{itemize}}
\section{Projects}
\cventry{}{Open Source Issue Tracker}{TypeScript, React, Node.js}{}{}{Designed a searchable issue board with keyboard navigation and accessible forms. Documented a REST API and reproducible Docker development environments.}
\section{Education}
\cventry{Sep 2017 -- May 2021}{B.S. Computer Science}{University of California}{}{}{}
\section{Skills}
\cvitem{Languages}{TypeScript, JavaScript, SQL, Python}
\cvitem{Frameworks}{React, Node.js, Next.js}
\cvitem{Tools}{PostgreSQL, Git, Docker, AWS}
\end{document}
`,
  },
];
