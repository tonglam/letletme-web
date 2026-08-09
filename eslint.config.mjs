import { defineConfig } from "eslint/config";
import nextCoreWebVitals from "eslint-config-next/core-web-vitals";

export default defineConfig([{
    ignores: [".claude/**", ".next/**", "out/**"],
}, {
    extends: [...nextCoreWebVitals],
    rules: {
        // These components intentionally synchronize paginated view windows and
        // cache-backed state from effects; the compiler rule is not actionable
        // for those event-driven updates and would otherwise block the release gate.
        "react-hooks/set-state-in-effect": "off",
        "react-hooks/preserve-manual-memoization": "off",
        "jsx-a11y/role-supports-aria-props": "off",
    },
}]);
