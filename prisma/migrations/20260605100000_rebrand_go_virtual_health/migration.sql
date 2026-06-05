UPDATE "Company"
SET "name" = 'Go Virtual Health',
    "logoUrl" = '/go-virtual-health-logo.jpeg'
WHERE "slug" = 'america-first-clinic'
   OR "name" IN ('America First Clinic', 'America Fist Clinic');

UPDATE "PartnerProfile"
SET "companyName" = 'Go Virtual Health'
WHERE "companyName" IN ('America First Clinic', 'America Fist Clinic');

UPDATE "PartnerProfile"
SET "displayName" = 'Go Virtual Health'
WHERE "displayName" IN ('America First Clinic', 'America Fist Clinic');
