import type {
  DinnerGroup,
  ItemShare,
  PaymentStatus,
  Receipt,
  SplitResult,
  SplitSummary,
  SplitWarning
} from "./types";

function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function sum(values: number[]): number {
  return values.reduce((total, value) => total + value, 0);
}

export function calculateSplit(
  receipt: Receipt,
  group: DinnerGroup,
  statuses: Record<string, PaymentStatus> = {}
): SplitSummary {
  const participantIds = group.participantIds.filter((id) => id !== group.payerId);
  const shares = new Map<string, ItemShare[]>();
  const warnings: SplitWarning[] = [];
  let assignedSubtotal = 0;
  let unassignedCount = 0;

  for (const participantId of participantIds) {
    shares.set(participantId, []);
  }

  for (const item of receipt.items) {
    if (item.assignedParticipantIds.length === 0) {
      unassignedCount += 1;
      continue;
    }

    assignedSubtotal += item.price;
    const itemShare = item.price / item.assignedParticipantIds.length;

    for (const participantId of item.assignedParticipantIds) {
      if (participantId === group.payerId) {
        continue;
      }

      const participantShares = shares.get(participantId);
      if (!participantShares) {
        continue;
      }

      participantShares.push({
        itemId: item.id,
        itemName: item.name,
        share: itemShare
      });
    }
  }

  if (group.participantIds.length === 0) {
    warnings.push({
      type: "no-participants",
      message: "Select at least one dinner participant."
    });
  }

  if (unassignedCount > 0) {
    warnings.push({
      type: "unassigned-items",
      message: `${unassignedCount} receipt item${unassignedCount === 1 ? "" : "s"} still needs people assigned.`
    });
  }

  const receiptSubtotal = sum(receipt.items.map((item) => item.price));
  const calculatedTotal = roundMoney(receiptSubtotal + receipt.tax + receipt.serviceCharge);

  if (Math.abs(calculatedTotal - receipt.total) > 0.01) {
    warnings.push({
      type: "total-mismatch",
      message: "Parsed items, tax, and service do not match the receipt total."
    });
  }

  const nonPayerAssignedSubtotal = sum(
    [...shares.values()].flat().map((itemShare) => itemShare.share)
  );

  const results: SplitResult[] = [...shares.entries()]
    .map(([participantId, itemShares]) => {
      const subtotal = sum(itemShares.map((itemShare) => itemShare.share));
      const proportion = assignedSubtotal === 0 ? 0 : subtotal / assignedSubtotal;
      return {
        participantId,
        itemShares: itemShares.map((itemShare) => ({
          ...itemShare,
          share: roundMoney(itemShare.share)
        })),
        subtotal: roundMoney(subtotal),
        taxShare: roundMoney(receipt.tax * proportion),
        serviceShare: roundMoney(receipt.serviceCharge * proportion),
        totalOwed: roundMoney(subtotal + receipt.tax * proportion + receipt.serviceCharge * proportion),
        status: statuses[participantId] ?? "unpaid"
      };
    })
    .filter((result) => result.totalOwed > 0 || result.status !== "paid");

  const displayedTotal = roundMoney(sum(results.map((result) => result.totalOwed)));
  const targetNonPayerTotal = roundMoney(
    nonPayerAssignedSubtotal +
      receipt.tax * (assignedSubtotal === 0 ? 0 : nonPayerAssignedSubtotal / assignedSubtotal) +
      receipt.serviceCharge * (assignedSubtotal === 0 ? 0 : nonPayerAssignedSubtotal / assignedSubtotal)
  );
  const remainder = roundMoney(targetNonPayerTotal - displayedTotal);

  if (remainder !== 0 && results.length > 0) {
    const largestDebtor = results.reduce((largest, current) =>
      current.totalOwed > largest.totalOwed ? current : largest
    );
    largestDebtor.serviceShare = roundMoney(largestDebtor.serviceShare + remainder);
    largestDebtor.totalOwed = roundMoney(largestDebtor.totalOwed + remainder);
  }

  return {
    results,
    warnings,
    assignedSubtotal: roundMoney(assignedSubtotal),
    calculatedTotal
  };
}
