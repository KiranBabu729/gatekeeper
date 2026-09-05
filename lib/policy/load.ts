import fs from "fs";
import path from "path";
import yaml from "js-yaml";
import { PolicySchema, type Policy } from "@/lib/policy/schema";

export function parsePolicyYaml(raw: string): Policy {
  const parsed = yaml.load(raw);
  return PolicySchema.parse(parsed);
}

export function loadPolicyFile(filename: string): { policy: Policy; raw: string } {
  const filePath = path.join(process.cwd(), "policy", filename);
  const raw = fs.readFileSync(filePath, "utf-8");
  return { policy: parsePolicyYaml(raw), raw };
}

export function loadCurrentPolicy(): { policy: Policy; raw: string } {
  return loadPolicyFile("policy.yaml");
}

export function loadPreviousPolicy(): { policy: Policy; raw: string } {
  return loadPolicyFile("policy.v1.yaml");
}
