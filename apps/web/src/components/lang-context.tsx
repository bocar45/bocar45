"use client";

import { createContext, useContext } from "react";
import type { Lang } from "@/lib/i18n";

const LangContext = createContext<Lang>("fr");
export const LangProvider = LangContext.Provider;
/** The reader's language in client components (set once by the root layout). */
export const useLang = () => useContext(LangContext);
