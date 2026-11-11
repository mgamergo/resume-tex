import type { Engine } from "./model";
const header = String.raw`% Original adaptation. Attribution and licenses: docs/templates.md
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
    description: "One column, compact section rules.",
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
{\Huge\bfseries\strut}\\[5pt]
\end{center}
\section{Experience}
\mbox{}
\section{Projects}
\mbox{}
\section{Education}
\mbox{}
\section{Skills}
\mbox{}
\end{document}
`,
  },
  {
    id: "deedy",
    name: "Deedy",
    description: "Two columns with sans-serif type.",
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
{\fontsize{36}{42}\selectfont\strut}\\[18pt]
\begin{minipage}[t]{0.31\textwidth}
\section{Education}
\mbox{}
\section{Skills}
\mbox{}
\end{minipage}\hfill
\begin{minipage}[t]{0.63\textwidth}
\section{Experience}
\mbox{}
\section{Projects}
\mbox{}
\end{minipage}
\end{document}
`,
  },
  {
    id: "alta",
    name: "AltaCV-style",
    description: "Blue section rules and a compact sidebar.",
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
{\Huge\bfseries\color{accent}\strut}\\[14pt]
\begin{minipage}[t]{0.64\textwidth}
\section{Experience}
\mbox{}
\section{Projects}
\mbox{}
\end{minipage}\hfill
\begin{minipage}[t]{0.30\textwidth}
\section{Skills}
\mbox{}
\section{Education}
\mbox{}
\end{minipage}
\end{document}
`,
  },
  {
    id: "moderncv",
    name: "moderncv",
    description: "Classic layout with a date column.",
    engine: "pdflatex",
    tags: ["Classic", "Professional"],
    source:
      header +
      String.raw`\documentclass[11pt,letterpaper,sans]{moderncv}
\moderncvstyle{banking}
\moderncvcolor{blue}
\usepackage[scale=0.82]{geometry}
\name{\strut}{}
\title{}
\begin{document}
\makecvtitle
\section{Experience}
\cvitem{}{\strut}
\section{Projects}
\cvitem{}{\strut}
\section{Education}
\cvitem{}{\strut}
\section{Skills}
\cvitem{}{\strut}
\end{document}
`,
  },
];
