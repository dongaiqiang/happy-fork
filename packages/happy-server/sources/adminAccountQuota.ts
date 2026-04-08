import { db } from "@/storage/db";
import { AdminAccountQuotaQuerySchema, queryAdminAccountQuota } from "@/app/quota/adminAccountQuota";

function parseArgs(argv: string[]) {
    const args: Record<string, string | boolean> = {};

    for (let index = 0; index < argv.length; index += 1) {
        const token = argv[index];
        if (!token.startsWith("--")) {
            continue;
        }

        const key = token.slice(2);
        const next = argv[index + 1];
        if (!next || next.startsWith("--")) {
            args[key] = true;
            continue;
        }

        args[key] = next;
        index += 1;
    }

    return args;
}

function readOption(args: Record<string, string | boolean>, ...keys: string[]) {
    for (const key of keys) {
        const value = args[key];
        if (typeof value === "string" && value.length > 0) {
            return value;
        }
    }

    return undefined;
}

function printUsage() {
    console.log(`账号额度查询脚本

用法：
  yarn workspace happy-server admin:account-quota -- --account-id <id>
  yarn workspace happy-server admin:account-quota -- --username <name>

示例：
  yarn workspace happy-server admin:account-quota -- --account-id cmxxxx
  yarn workspace happy-server admin:account-quota -- --username alice
`);
}

async function main() {
    const args = parseArgs(process.argv.slice(2));

    if (args.help === true || args.h === true) {
        printUsage();
        process.exit(0);
    }

    const parsed = AdminAccountQuotaQuerySchema.safeParse({
        accountId: readOption(args, "account-id", "accountId"),
        username: readOption(args, "username"),
    });

    if (!parsed.success) {
        const message = parsed.error.issues.map((issue) => {
            const path = issue.path.length > 0 ? issue.path.join(".") : "input";
            return `${path}: ${issue.message}`;
        }).join("\n");
        console.error(message);
        console.error("");
        printUsage();
        process.exit(1);
    }

    const quotaSnapshot = await queryAdminAccountQuota(parsed.data);
    if (!quotaSnapshot) {
        console.error("account_not_found");
        process.exit(1);
    }

    console.log(JSON.stringify({
        success: true,
        ...quotaSnapshot,
    }, null, 2));
}

main()
    .catch((error) => {
        console.error(error);
        process.exitCode = 1;
    })
    .finally(async () => {
        await db.$disconnect();
    });
