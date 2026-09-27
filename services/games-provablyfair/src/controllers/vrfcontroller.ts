import crypto from "node:crypto";
import type { Request, Response } from "express";
import { Pool } from "pg";
import { HSMProvider } from "../vrf/hsmprovider";
import { ChainlinkProvider } from "../vrf/chainlinkprovider";
import { publishProofToS3 } from "../utils/publishproof";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const provider =
  process.env.CHAINLINK_VRF_ENABLED === "true"
    ? new ChainlinkProvider()
    : new HSMProvider();

export async function requestAndStore(req: Request, res: Response) {
  const { seedHint } = req.body ?? {};
  const { requestId } = await provider.requestRandomness(seedHint);
  res.json({ requestId });
}

export async function pollAndPersist(requestId: string) {
  const proof = await provider.getProof(requestId);
  const s3key = `proofs/${requestId}.json`;

  await publishProofToS3(s3key, proof);

  await pool.query(
    "INSERT INTO game_provable_receipts (game_id, round_id, server_seed_hash, server_seed, client_seed, result, proof, created_at) VALUES ($1,$2,$3,$4,$5,$6,$7,now())",
    [
      "demo-game",
      requestId,
      crypto.createHash("sha256").update(proof.seed).digest("hex"),
      proof.seed,
      null,
      JSON.stringify({}),
      JSON.stringify(proof),
    ]
  );
}
