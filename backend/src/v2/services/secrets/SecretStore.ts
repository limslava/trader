import { TenantSecretVault } from './TenantSecretVault';
import { VaultSecretVault } from './VaultSecretVault';

const vaultAddr = process.env.VAULT_ADDR;
const vaultToken = process.env.VAULT_TOKEN;
const vaultMount = process.env.VAULT_MOUNT || 'secret';
const hasVaultConfig = Boolean(
  vaultAddr &&
  vaultToken &&
  vaultToken !== 'your-vault-token' &&
  vaultToken !== 'change-me'
);

export const secretStore = hasVaultConfig
  ? new VaultSecretVault({ addr: vaultAddr!, token: vaultToken!, mount: vaultMount })
  : new TenantSecretVault();
