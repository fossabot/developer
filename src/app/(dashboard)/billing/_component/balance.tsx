"use client"

import { BalanceInput } from "@/components/balance-input"
import {
	useDepositedRss3Balance,
	useRss3Allowance,
	useRss3Approve,
	useRss3Balance,
	useRss3Deposit,
} from "@/data/contracts/hooks"
import {
	useGetCurrentRequestWithdrawal,
	useRequestWithdrawal,
} from "@/data/gateway/hooks"
import {
	Button,
	Divider,
	Group,
	Modal,
	NumberFormatter,
	Skeleton,
	Stack,
	Text,
	Title,
	Tooltip,
} from "@mantine/core"
import { useForm } from "@mantine/form"
import { openConfirmModal } from "@mantine/modals"
import { IconExclamationCircle } from "@tabler/icons-react"
import { valibotResolver } from "mantine-form-valibot-resolver"
import { useCallback, useEffect, useMemo, useState } from "react"
import { Input, maxValue, minValue, number, object } from "valibot"
import { formatUnits, parseUnits } from "viem"

export function Balance() {
	const depositedRss3 = useDepositedRss3Balance()
	const rss3 = useRss3Balance()

	return (
		<>
			<Stack>
				<Group>
					<Stack gap="xs">
						<Group gap="xs">
							<Text c="dimmed">Deposited $RSS3</Text>
							<Tooltip label="Deposited $RSS3 can be used to pay for API calls. You can withdraw your $RSS3 at any time.">
								<Text c="dimmed">
									<IconExclamationCircle />
								</Text>
							</Tooltip>
						</Group>
						<Text size="xl" fw="bold" ff="monospace">
							<NumberFormatter
								thousandSeparator
								value={formatUnits(
									depositedRss3.data ?? 0n,
									depositedRss3.tokenDecimals,
								)}
							/>
						</Text>
					</Stack>

					<Divider orientation="vertical" />

					<Stack gap="xs">
						<Text c="dimmed">$RSS3</Text>
						<Text size="xl" fw="bold" ff="monospace">
							<NumberFormatter
								thousandSeparator
								value={formatUnits(rss3.data ?? 0n, rss3.tokenDecimals)}
							/>
						</Text>
					</Stack>
				</Group>

				<Actions />
			</Stack>
		</>
	)
}

function Actions() {
	return (
		<Group>
			<ActionButton Modal={DepositModal}>Deposit</ActionButton>
			<ActionButton Modal={WithdrawModal}>Withdraw</ActionButton>
		</Group>
	)
}

function DepositModal({
	opened,
	onClose,
}: {
	opened: boolean
	onClose: () => void
}) {
	const rss3 = useRss3Balance()
	const maxBalance = parseFloat(
		formatUnits(rss3.data ?? 0n, rss3.tokenDecimals),
	)

	const formSchema = useMemo(
		() =>
			object({
				amount: number([
					minValue(0),
					maxValue(maxBalance, `Insufficient balance (max: ${maxBalance})`),
				]),
			}),
		[maxBalance],
	)

	const form = useForm<Input<typeof formSchema>>({
		initialValues: {
			amount: 0,
		},
		validate: valibotResolver(formSchema),
	})

	const allowance = useRss3Allowance()

	const requestedAmount = parseUnits(
		form.values.amount.toString(),
		rss3.tokenDecimals,
	)
	const approve = useRss3Approve(requestedAmount)

	const deposit = useRss3Deposit(requestedAmount)

	const isExceededAllowance =
		typeof rss3.data !== "undefined" &&
		typeof allowance.data !== "undefined" &&
		requestedAmount > allowance.data

	const handleDeposit = (values: Input<typeof formSchema>) => {
		if (
			typeof rss3.data === "undefined" ||
			typeof allowance.data === "undefined"
		) {
			return
		}

		// approve

		if (isExceededAllowance) {
			// set allowance
			openConfirmModal({
				centered: true,
				title: "One More Step: Approve Token Allowance",
				children: (
					<>
						<Text>
							Please increase your allowance to{" "}
							<Text span ff="monospace" fw="bold">
								<NumberFormatter value={values.amount} suffix=" RSS3" />
							</Text>{" "}
							.
						</Text>
						<Text>
							Current allowance:{" "}
							<Text span ff="monospace" fw="bold">
								<NumberFormatter
									value={formatUnits(allowance.data, rss3.tokenDecimals)}
									suffix=" RSS3"
								/>
							</Text>
						</Text>
						<Text size="sm" c="dimmed">
							*Allowance is a predetermined limit set by you on how much $RSS3
							can be managed by the RSS3 Billing contract.
						</Text>
					</>
				),
				labels: { confirm: "Approve", cancel: "Cancel" },
				onConfirm: () => {
					approve.contractWrite.write?.()
				},
			})

			return
		}

		// deposit

		deposit.contractWrite.write?.()
	}

	const handleClose = useCallback(() => {
		form.reset()
		onClose()
	}, [])

	useEffect(() => {
		if (deposit.waitForTransaction.isSuccess) {
			handleClose()
		}
	}, [deposit.waitForTransaction.isSuccess])

	return (
		<Modal
			opened={opened}
			onClose={handleClose}
			title="Deposit $RSS3"
			centered
			closeOnClickOutside={!form.isDirty()}
		>
			<form onSubmit={form.onSubmit(handleDeposit)}>
				<BalanceInput
					max={maxBalance}
					onClickMax={() => {
						form.setFieldValue("amount", maxBalance)
					}}
					{...form.getInputProps("amount")}
				/>

				<Group mt="md" justify="flex-end">
					<Button
						variant="default"
						onClick={handleClose}
						disabled={
							deposit.contractWrite.isLoading ||
							deposit.waitForTransaction.isLoading
						}
					>
						Cancel
					</Button>
					<Button
						type="submit"
						loading={
							approve.contractWrite.isLoading ||
							approve.waitForTransaction.isLoading ||
							deposit.contractWrite.isLoading ||
							deposit.waitForTransaction.isLoading ||
							rss3.isLoading ||
							allowance.isLoading
						}
						disabled={!form.values.amount}
					>
						{isExceededAllowance ? "Approve" : "Deposit"}
					</Button>
				</Group>
			</form>
		</Modal>
	)
}

function ActionButton({
	Modal,
	children,
}: {
	Modal: ({
		opened,
		onClose,
	}: {
		opened: boolean
		onClose: () => void
	}) => React.ReactNode
	children: React.ReactNode
}) {
	const [opened, setOpened] = useState(false)

	return (
		<>
			<Button onClick={() => setOpened(true)}>{children}</Button>

			<Modal opened={opened} onClose={() => setOpened(false)} />
		</>
	)
}

function WithdrawModal({
	opened,
	onClose,
}: {
	opened: boolean
	onClose: () => void
}) {
	const depositedRss3 = useDepositedRss3Balance()
	const currentRequestWithdrawal = useGetCurrentRequestWithdrawal()

	const depositedRss3Balance = depositedRss3.data ?? 0n

	const maxBalance = parseFloat(
		formatUnits(depositedRss3Balance, depositedRss3.tokenDecimals),
	)

	const requestWithdrawal = useRequestWithdrawal()

	const formSchema = useMemo(
		() =>
			object({
				amount: number([
					minValue(0),
					maxValue(maxBalance, `Insufficient balance (max: ${maxBalance})`),
				]),
			}),
		[maxBalance],
	)

	const form = useForm<Input<typeof formSchema>>({
		initialValues: {
			amount: 0,
		},
		validate: valibotResolver(formSchema),
	})

	const withdraw = useRequestWithdrawal()

	const handleClose = useCallback(() => {
		form.reset()
		onClose()
	}, [])

	useEffect(() => {
		if (withdraw.isSuccess) {
			handleClose()
		}
	}, [withdraw.isSuccess])

	const Warning = () => {
		return (
			currentRequestWithdrawal.data &&
			currentRequestWithdrawal.data.amount > 0 && (
				<Text c="red" size="sm" my="md">
					<Text span fw="bold" ff="monospace">
						<NumberFormatter
							value={currentRequestWithdrawal.data.amount}
							thousandSeparator
							suffix=" RSS3"
						/>
					</Text>{" "}
					is pending withdrawal. If you withdraw again now, the pending
					withdrawal will be replaced by this one.
				</Text>
			)
		)
	}

	const handleWithdraw = (values: Input<typeof formSchema>) => {
		openConfirmModal({
			centered: true,
			title: "Please confirm your action",
			children: (
				<>
					<Text>
						Please confirm that you want to withdraw{" "}
						<Text span ff="monospace" fw="bold">
							<NumberFormatter value={values.amount} suffix=" RSS3" />
						</Text>{" "}
						from your deposited $RSS3.
					</Text>
					<Warning />
				</>
			),
			labels: { confirm: "Withdraw", cancel: "Cancel" },
			onConfirm: () => {
				withdraw.mutate({ amount: values.amount })
			},
		})
	}

	return (
		<Modal
			opened={opened}
			onClose={handleClose}
			title={
				<Group gap="xs">
					<Text>Withdraw Deposited $RSS3</Text>
					<Tooltip
						maw={300}
						multiline
						label={
							<>
								Withdrawal requests are processed at the end of each epoch
								(every 18 hours).
								<br />
								The final amount you receive will include deductions for the
								following:
								<br />
								1. Ethereum Gas fees (converted to $RSS3), determined by the
								busyness of the Ethereum blockchain.
								<br />
								2. RSS3 Network usage fees that incurred after initiating the
								withdrawal request, if any.
							</>
						}
					>
						<IconExclamationCircle />
					</Tooltip>
				</Group>
			}
			centered
			closeOnClickOutside={!form.isDirty()}
		>
			<form onSubmit={form.onSubmit(handleWithdraw)}>
				<BalanceInput
					max={maxBalance}
					onClickMax={() => {
						form.setFieldValue("amount", maxBalance)
					}}
					{...form.getInputProps("amount")}
				/>

				<Warning />

				<Group mt="md" justify="flex-end">
					<Button
						variant="default"
						onClick={handleClose}
						disabled={
							depositedRss3.isLoading ||
							requestWithdrawal.isPending ||
							withdraw.isPending
						}
					>
						Cancel
					</Button>
					<Button
						type="submit"
						loading={
							depositedRss3.isLoading ||
							requestWithdrawal.isPending ||
							withdraw.isPending
						}
						disabled={!form.values.amount}
					>
						Request
					</Button>
				</Group>
			</form>
		</Modal>
	)
}