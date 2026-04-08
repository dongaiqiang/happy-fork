import { db } from "@/storage/db";
import { AdminUpgradeInputSchema, executeAdminUpgrade } from "@/app/quota/adminUpgrade";

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
    console.log(`账号提档脚本

用法：
  yarn workspace happy-server admin:upgrade -- --account-id <id> --tier <free|student|pro|team|enterprise>
  yarn workspace happy-server admin:upgrade -- --username <name> --tier <free|student|pro|team|enterprise>

可选参数：
  --billing-period <monthly|annual>
  --status <free|active|cancelled|expired>
  --end-date <ISO datetime|null>

示例：
  yarn workspace happy-server admin:upgrade -- --account-id cmxxxx --tier pro --billing-period annual
  yarn workspace happy-server admin:upgrade -- --username alice --tier team --status active
`);
}

async function main() {
    const args = parseArgs(process.argv.slice(2));

    if (args.help === true || args.h === true) {
        printUsage();
        process.exit(0);
    }

    const parsed = AdminUpgradeInputSchema.safeParse({
        accountId: readOption(args, "account-id", "accountId"),
        username: readOption(args, "username"),
        tier: readOption(args, "tier"),
        billingPeriod: readOption(args, "billing-period", "billingPeriod"),
        status: readOption(args, "status"),
        endDate: readOption(args, "end-date", "endDate"),
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

    const upgraded = await executeAdminUpgrade(parsed.data);
    if (!upgraded) {
        console.error("account_not_found");
        process.exit(1);
    }

    console.log(JSON.stringify({
        success: true,
        ...upgraded,
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
