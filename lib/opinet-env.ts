const OPINET_ENV_KEYS = ["OPINET_CERTKEY", "OPINET_API_KEY", "OPINET_CERTEY"] as const;

export function readOpinetCertkey() {
  for (const key of OPINET_ENV_KEYS) {
    const value = process.env[key]?.trim();

    if (value) {
      return value;
    }
  }

  return undefined;
}
