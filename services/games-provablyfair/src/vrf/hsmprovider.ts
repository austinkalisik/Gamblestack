import { IVRFProvider } from "./index";
import { v4 as uuidv4 } from "uuid";

export class HSMProvider implements IVRFProvider {
  async requestRandomness(seedHint = "") {
    const requestId = uuidv4();
    const endpoint = process.env.HSM_API_ENDPOINT;

    if (!endpoint) {
      return { requestId };
    }

    await fetch(endpoint + "/request", {
      method: "POST",
      body: JSON.stringify({ requestId, seedHint }),
      headers: { "Content-Type": "application/json" },
    });

    return { requestId };
  }

  async getProof(requestId: string) {
    const endpoint = process.env.HSM_API_ENDPOINT;

    if (!endpoint) {
      return {
        requestId,
        seed: uuidv4().replace(/-/g, ""),
        proof: { provider: "local-mvp-fallback" },
      };
    }

    const response = await fetch(endpoint + `/proof/${requestId}`);
    if (!response.ok) throw new Error("no proof yet");

    const proof = (await response.json()) as {
      seed: string;
      signature?: unknown;
    };

    return {
      requestId,
      seed: proof.seed,
      proof: proof.signature ?? null,
    };
  }
}
