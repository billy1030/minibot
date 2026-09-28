/**
 * Converts common LaTeX math notation in a string to Unicode equivalents.
 *
 * Handles both display math ($$...$$) and inline patterns like `$\to$`.
 * Useful for cleaning up LLM output that contains LaTeX math symbols.
 */

/** Map of LaTeX command to Unicode character */
const LATEX_SYMBOL_MAP: Record<string, string> = {
  // Arrows
  "\\to": "\u2192",
  "\\leftarrow": "\u2190",
  "\\rightarrow": "\u2192",
  "\\Leftarrow": "\u21D0",
  "\\Rightarrow": "\u21D2",
  "\\leftrightarrow": "\u2194",
  "\\Leftrightarrow": "\u27FA",
  "\\uparrow": "\u2191",
  "\\downarrow": "\u2193",
  "\\updownarrow": "\u2195",
  "\\nearrow": "\u2197",
  "\\searrow": "\u2198",
  "\\swarrow": "\u2199",
  "\\nwarrow": "\u2196",
  "\\mapsto": "\u21A6",
  "\\longrightarrow": "\u27F6",
  "\\longleftarrow": "\u27F5",

  // Greek lowercase
  "\\alpha": "\u03B1",
  "\\beta": "\u03B2",
  "\\gamma": "\u03B3",
  "\\delta": "\u03B4",
  "\\epsilon": "\u03B5",
  "\\varepsilon": "\u03B5",
  "\\zeta": "\u03B6",
  "\\eta": "\u03B7",
  "\\theta": "\u03B8",
  "\\vartheta": "\u03D1",
  "\\iota": "\u03B9",
  "\\kappa": "\u03BA",
  "\\lambda": "\u03BB",
  "\\mu": "\u03BC",
  "\\nu": "\u03BD",
  "\\xi": "\u03BE",
  "\\pi": "\u03C0",
  "\\varpi": "\u03D6",
  "\\rho": "\u03C1",
  "\\varrho": "\u03F1",
  "\\sigma": "\u03C3",
  "\\varsigma": "\u03C2",
  "\\tau": "\u03C4",
  "\\upsilon": "\u03C5",
  "\\phi": "\u03C6",
  "\\varphi": "\u03C6",
  "\\chi": "\u03C7",
  "\\psi": "\u03C8",
  "\\omega": "\u03C9",

  // Greek uppercase
  "\\Gamma": "\u0393",
  "\\Delta": "\u0394",
  "\\Theta": "\u0398",
  "\\Lambda": "\u039B",
  "\\Xi": "\u039E",
  "\\Pi": "\u03A0",
  "\\Sigma": "\u03A3",
  "\\Upsilon": "\u03A5",
  "\\Phi": "\u03A6",
  "\\Psi": "\u03A8",
  "\\Omega": "\u03A9",

  // Relations
  "\\leq": "\u2264",
  "\\geq": "\u2265",
  "\\neq": "\u2260",
  "\\approx": "\u2248",
  "\\equiv": "\u2261",
  "\\sim": "\u223C",
  "\\simeq": "\u2243",
  "\\cong": "\u2245",
  "\\propto": "\u221D",
  "\\subset": "\u2282",
  "\\supset": "\u2283",
  "\\subseteq": "\u2286",
  "\\supseteq": "\u2287",
  "\\in": "\u2208",
  "\\notin": "\u2209",
  "\\ni": "\u220B",
  "\\ll": "\u226A",
  "\\gg": "\u226B",

  // Operators
  "\\pm": "\u00B1",
  "\\mp": "\u2213",
  "\\times": "\u00D7",
  "\\div": "\u00F7",
  "\\cdot": "\u00B7",
  "\\circ": "\u2218",
  "\\bullet": "\u2022",
  "\\star": "\u2605",
  "\\oplus": "\u2295",
  "\\ominus": "\u2296",
  "\\otimes": "\u2297",
  "\\oslash": "\u2298",
  "\\odot": "\u2299",
  "\\cap": "\u2229",
  "\\cup": "\u222A",
  "\\setminus": "\u2216",
  "\\wedge": "\u2227",
  "\\vee": "\u2228",
  "\\neg": "\u00AC",

  // Misc math
  "\\infty": "\u221E",
  "\\partial": "\u2202",
  "\\nabla": "\u2207",
  "\\forall": "\u2200",
  "\\exists": "\u2203",
  "\\nexists": "\u2204",
  "\\emptyset": "\u2205",
  "\\varnothing": "\u2205",
  "\\aleph": "\u2135",
  "\\sqrt": "\u221A",
  "\\angle": "\u2220",
  "\\perp": "\u22A5",
  "\\parallel": "\u2225",
  "\\mid": "\u2223",
  "\\nmid": "\u2224",
  "\\sum": "\u03A3",
  "\\prod": "\u03A0",
  "\\int": "\u222B",
  "\\oint": "\u222E",
  "\\therefore": "\u2234",
  "\\because": "\u2235",

  // Dots
  "\\ldots": "\u2026",
  "\\cdots": "\u22EF",
  "\\vdots": "\u22EE",
  "\\ddots": "\u22F1",
};

/**
 * Converts LaTeX math symbols inside dollar-sign delimiters to Unicode.
 *
 * Examples:
 *   "A $\to$ B"          =>  "A → B"
 *   "$\alpha + \beta$"   =>  "α + β"
 *   "$$\Sigma$$"         =>  "Σ"
 *
 * Non-symbol content (e.g. `$x^2$`, fractions) has dollar signs stripped
 * after symbol substitution; remaining unknown commands are removed.
 */
export function convertLatexToUnicode(text: string): string {
  // Sort commands by length descending to prevent partial matches
  // e.g. \\rightarrow must be matched before a hypothetical \\right
  const sortedCommands = Object.keys(LATEX_SYMBOL_MAP).sort(
    (a, b) => b.length - a.length
  );

  function convertInner(inner: string): string {
    let result = inner.trim();

    for (const cmd of sortedCommands) {
      // Escape the leading backslash for RegExp; match only when not followed by a letter
      const escaped = cmd.replace(/\\/g, "\\\\");
      result = result.replace(
        new RegExp(`${escaped}(?![a-zA-Z])`, "g"),
        LATEX_SYMBOL_MAP[cmd]
      );
    }

    // Remove any remaining unknown backslash commands
    result = result.replace(/\\[a-zA-Z]+\s*/g, "");

    return result.trim();
  }

  // Replace $$...$$ (display math) first to avoid double-processing
  text = text.replace(/\$\$([\s\S]+?)\$\$/g, (_match, inner: string) =>
    convertInner(inner)
  );

  // Replace $...$ (inline math)
  text = text.replace(/\$((?:[^$]|\\.)+?)\$/g, (_match, inner: string) =>
    convertInner(inner)
  );

  return text;
}
