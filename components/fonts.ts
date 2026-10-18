import { Archivo } from "next/font/google";

/** UI face with a width axis: regular for reading, condensed for field captions. */
export const archivo = Archivo({ variable: "--font-archivo", subsets: ["latin"], axes: ["wdth"], display: "swap" });
