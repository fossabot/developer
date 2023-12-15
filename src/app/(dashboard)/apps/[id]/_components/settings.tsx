"use client"

import { useReassignKeySecret, useUpdateKey } from "@/data/gateway/hooks"
import {
	ActionIcon,
	Box,
	Button,
	CopyButton,
	PasswordInput,
	Skeleton,
	Text,
	TextInput,
	Title,
	Tooltip,
	rem,
} from "@mantine/core"
import { useForm } from "@mantine/form"
import { openConfirmModal } from "@mantine/modals"
import { showNotification } from "@mantine/notifications"
import { IconCheck, IconCopy } from "@tabler/icons-react"
import { valibotResolver } from "mantine-form-valibot-resolver"
import { useCallback, useEffect } from "react"
import { type Input, minLength, object, string } from "valibot"

export function Settings({
	id,
	name,
	passkey,
}: {
	id: number
	name?: string
	passkey?: string
}) {
	return (
		<>
			<Title order={3}>Settings</Title>

			<Box maw={300}>
				<NameForm id={id} name={name} />
				<KeyForm id={id} passkey={passkey} />
			</Box>
		</>
	)
}

const nameSchema = object({
	name: string([minLength(1)]),
})

type NameFormData = Input<typeof nameSchema>

function NameForm({ id, name }: { id: number; name?: string }) {
	const nameForm = useForm<NameFormData>({
		initialValues: {
			name: name || "",
		},
		validate: valibotResolver(nameSchema),
	})

	useEffect(() => {
		if (!nameForm.values.name && name) {
			nameForm.setFieldValue("name", name)
		}
	}, [name])

	const updateKey = useUpdateKey()

	return (
		<form
			className="space-y-2"
			onSubmit={nameForm.onSubmit((values) =>
				updateKey.mutate({
					id: id,
					name: values.name,
				}),
			)}
		>
			<TextInput mt="md" label="Name" {...nameForm.getInputProps("name")} />

			<Button mt="md" type="submit" loading={updateKey.isPending}>
				Save
			</Button>
		</form>
	)
}

function KeyForm({ id, passkey }: { id: number; passkey?: string }) {
	const reassignKey = useReassignKeySecret()

	const handleRegenerate = useCallback(() => {
		openConfirmModal({
			centered: true,
			title: "Please confirm your action",
			children: (
				<Text size="sm">
					Once you regenerate your app key, the old key will be invalidated.
					Please make sure you are certain before proceeding.
				</Text>
			),
			confirmProps: {
				color: "red",
			},
			labels: { confirm: "Regenerate", cancel: "Cancel" },
			onConfirm: () => {
				reassignKey.mutate({ id })
			},
		})
	}, [id])

	return (
		<>
			<PasswordInput
				mt="md"
				label="Key"
				value={passkey || ""}
				readOnly
				leftSectionPointerEvents="all"
				leftSection={
					<CopyButton value={passkey || ""}>
						{({ copied, copy }) => (
							<Tooltip
								label={copied ? "Copied" : "Copy"}
								withArrow
								position="right"
							>
								<ActionIcon
									color={copied ? "teal" : "gray"}
									variant="subtle"
									onClick={copy}
								>
									{copied ? (
										<IconCheck style={{ width: rem(16) }} />
									) : (
										<IconCopy style={{ width: rem(16) }} />
									)}
								</ActionIcon>
							</Tooltip>
						)}
					</CopyButton>
				}
			/>

			<Button
				mt="md"
				color="red"
				onClick={handleRegenerate}
				loading={reassignKey.isPending}
			>
				Regenerate Key
			</Button>
		</>
	)
}
