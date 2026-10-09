const nextConfig = require('eslint-config-next')

module.exports = [
  ...nextConfig.map((config, index) => {
    if (index === 0) {
      // Merge the rules for the first config (the 'next' config)
      return {
        ...config,
        rules: {
          ...config.rules,
          "@next/next/no-img-element": "off",
          "react-hooks/exhaustive-deps": "warn",
          "no-console": ["warn", { "allow": ["warn", "error"] }]
        }
      }
    }
    return config
  })
]
