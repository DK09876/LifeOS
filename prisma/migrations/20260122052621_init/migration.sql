-- CreateTable
CREATE TABLE "Domain" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "domain" TEXT NOT NULL,
    "domainPriority" TEXT NOT NULL DEFAULT '3 - Maintenance',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Task" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "taskName" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'Backlog',
    "taskPriority" TEXT NOT NULL DEFAULT '3 - Normal',
    "dueDate" DATETIME,
    "plannedDate" DATETIME,
    "recurrence" TEXT NOT NULL DEFAULT 'None',
    "lastCompleted" DATETIME,
    "actionPoints" INTEGER,
    "notes" TEXT,
    "domainId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Task_domainId_fkey" FOREIGN KEY ("domainId") REFERENCES "Domain" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
