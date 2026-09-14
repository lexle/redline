export type Clause = {
  number: number;
  heading: string;
  text: string;
};

export type Flag = {
  rank: number;
  clause: number;
  sentence: string;
  title: string;
  plain: string;
};

export const agreementTitle = "Independent Contractor Agreement";

export const preamble =
  'This Independent Contractor Agreement (the "Agreement") is made as of the Effective Date between the company named in Exhibit A ("Company") and the person named in Exhibit A ("Contractor").';

export const clauses: Clause[] = [
  {
    number: 1,
    heading: "Services",
    text: 'Contractor will perform the services described in Exhibit A (the "Services") and deliver the work described there (the "Project"). Contractor controls the manner and means of performing the Services.',
  },
  {
    number: 2,
    heading: "Fees and Payment",
    text: "Company will pay Contractor the fees set out in Exhibit A. Contractor will invoice Company monthly, and Company will pay each undisputed invoice within thirty (30) days of receiving it.",
  },
  {
    number: 3,
    heading: "Term and Termination",
    text: 'This Agreement begins on the Effective Date and continues until the Project is complete (the "Term"). Either party may end this Agreement by giving fourteen (14) days\' written notice. If Contractor ends this Agreement for any reason before the Project is complete, Contractor shall be liable for any and all costs Company incurs to complete the Project.',
  },
  {
    number: 4,
    heading: "Ownership of Work Product",
    text: "Contractor hereby assigns to Company all right, title and interest in any work product, ideas or materials that Contractor creates during the Term, whether or not related to the Services. Contractor will sign any document Company reasonably requests to confirm this assignment.",
  },
  {
    number: 5,
    heading: "Confidentiality",
    text: "Contractor will hold Company's Confidential Information in confidence and use it only to perform the Services. This obligation continues for three (3) years after this Agreement ends.",
  },
  {
    number: 6,
    heading: "Non-Solicitation",
    text: "For twenty-four (24) months after this Agreement ends, Contractor shall not provide services to any client or customer of Company.",
  },
  {
    number: 7,
    heading: "Independent Contractor Status",
    text: "Contractor is an independent contractor and is responsible for all taxes on amounts paid under this Agreement.",
  },
  {
    number: 8,
    heading: "Governing Law",
    text: "This Agreement is governed by the laws of the state named in Exhibit A, without regard to its conflict-of-laws rules.",
  },
];

export const flags: Flag[] = [
  {
    rank: 1,
    clause: 3,
    sentence:
      "If Contractor ends this Agreement for any reason before the Project is complete, Contractor shall be liable for any and all costs Company incurs to complete the Project.",
    title: "Leave early and you pay to finish the job",
    plain:
      "If you end the contract before the project is done, for any reason, you owe whatever it costs them to finish it. Nothing in the clause caps that amount.",
  },
  {
    rank: 2,
    clause: 6,
    sentence:
      "For twenty-four (24) months after this Agreement ends, Contractor shall not provide services to any client or customer of Company.",
    title: "For two years, you can't work for any of their clients",
    plain:
      "The ban covers every client and customer the company has, including ones you never dealt with on this project, and it lasts 24 months after the contract ends.",
  },
  {
    rank: 3,
    clause: 4,
    sentence:
      "Contractor hereby assigns to Company all right, title and interest in any work product, ideas or materials that Contractor creates during the Term, whether or not related to the Services.",
    title: "They own everything you make while the contract runs",
    plain:
      "The assignment covers any work, idea or material you create during the contract, including work that has nothing to do with this project.",
  },
];

// The sample holds itself to ADR-0001: a flag whose sentence is not in its clause word for word fails the build.
export function splitClause(clause: Clause) {
  const flag = flags.find((candidate) => candidate.clause === clause.number);
  if (!flag) return { before: clause.text, flag: undefined, after: "" };
  const start = clause.text.indexOf(flag.sentence);
  if (start === -1) {
    throw new Error(`Sample flag ${flag.rank} does not quote section ${clause.number} word for word.`);
  }
  return {
    before: clause.text.slice(0, start),
    flag,
    after: clause.text.slice(start + flag.sentence.length),
  };
}
