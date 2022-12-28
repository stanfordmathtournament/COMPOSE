<script>
	import { supabase } from "$lib/supabaseClient";
	import {
		TextArea,
		InlineNotification,
		Select,
		SelectItem,
	} from "carbon-components-svelte";
	import Button from "$lib/components/Button.svelte";
	import { getThisUserRole } from "$lib/getUserRole";

	const regexes = {
		topic: /\\ques\[(\w*)\]/s,
		question: /\\begin\{question\}\s*(.*)\s*\\end\{question\}/s,
		comment: /\\begin\{comment\}\s*(.*)\s*\\end\{comment\}/s,
		answer: /\\begin\{answer\}\s*(.*)\s*\\end\{answer\}/s,
		solution: /\\begin\{solution\}\s*(.*)\s*\\end\{solution\}/s,
		multisolution:
			/\\begin\{solution\*\}\s*\\soln\{(\d+)\}\s*(.*?)\s*\\end\{solution\*\}/gs,
	};

	const texRegex =
		/^(?=\\begin\{question\}\s*(?<question>.*)\s*\\end\{question\})(?=\\begin\{comment\}\s*(?<comment>.*)\s*\\end\{comment\})(?=\\begin\{answer\}\s*(?<answer>.*)\s*\\end\{answer\})(?=\\begin\{solution\}\s*(?<solution>.*)\s*\\end\{solution\}).*$/s;

	const idMap = {
		Alg: 1,
		Combo: 2,
		Geo: 3,
		NT: 4,
	};

	let files;
	let errorMessages = [];
	let payloads = [];
	let success = false;
	let problemText;
	let allUsers;
	let loadedUsers = false;
	let userSelectRef;
	let isAdmin = false;

	let errorTrue = false;
	let errorMessage = "";

	$: if (files) {
		checkFiles();
	}

	async function checkFiles() {
		for (const file of files) {
			const extension = file.name.split(".").pop();
			if (extension !== "tex") {
				errorMessages.push(
					`Skipped file ${file.name} because it is not a .tex file`
				);
			} else {
				const text = await file.text();
				importProblem(text, file.name);
			}
		}

		payloads = payloads;
		errorMessages = errorMessages;
	}

	function manualAdd() {
		if (!importProblem(problemText)) {
			errorTrue = true;
			errorMessage = "Manual import failed due to improper format";
		} else {
			problemText = "";
		}
	}

	function importProblem(text, name) {
		const user = supabase.auth.user();
		const getResult = (regex) => {
			const res = text.match(regex);
			if (!res) return null;
			return res[1];
		};

		const multisolutionResult = [...text.matchAll(regexes.multisolution)];
		let newSolution = null;
		if (multisolutionResult.length > 0) {
			newSolution = "";
			for (const res of multisolutionResult) {
				let [_, solNum, solText] = res;
				newSolution += `\nSolution ${solNum}:\n\n${solText}\n`;
			}
		}

		const payload = {
			problem_latex: getResult(regexes.question) ?? "",
			comment_latex: getResult(regexes.comment) ?? "",
			answer_latex: getResult(regexes.answer) ?? "",
			solution_latex: newSolution ?? getResult(regexes.solution) ?? "",
			topics: [getResult(regexes.topic) ?? ""],
			sub_topics: "",
			difficulty: 0,
			edited_at: new Date().toISOString(),
			author_id: userSelectRef && userSelectRef != "" ? userSelectRef : user.id,
		};
		payloads = [...payloads, payload];
		return true;
	}

	async function submitProblems() {
		success = false;
		let payloadList = [];
		for (const payload of payloads) {
			const { topics, ...payloadNoTopics } = payload;
			payloadNoTopics.author_id =
				userSelectRef && userSelectRef != ""
					? userSelectRef
					: supabase.auth.user().id;
			payloadList.push(payloadNoTopics);
		}

		let { data, error } = await supabase.from("problems").insert(payloadList);
		if (error) {
			errorTrue = true;
			errorMessage = error.message;
		} else {
			let topicList = [];

			for (const payload of payloads) {
				const topics = payload.topics;
				// find it in the list
				const foundProblem = data.find((pb) =>
					[
						"problem_latex",
						"comment_latex",
						"answer_latex",
						"solution_latex",
					].every((field) => pb[field] === payload[field])
				); // don't worry about it

				if (!foundProblem) {
					console.log("error: problem submitted but not found");
				} else {
					for (const tp of topics) {
						if (!idMap[tp]) continue;
						topicList.push({
							problem_id: foundProblem.id,
							topic_id: idMap[tp],
						});
					}
				}
			}

			let { error2 } = await supabase.from("problem_topics").insert(topicList);
			if (error2) {
				errorTrue = true;
				errorMessage = error2.message;
			}

			payloads = [];
			success = true;
		}
	}

	async function getAllUsers() {
		let { data: users, error } = await supabase
			.from("users")
			.select("full_name,id");
		if (error) throw error;
		allUsers = users;
		loadedUsers = true;
		isAdmin = (await getThisUserRole()) >= 40;
	}

	getAllUsers();
</script>

{#if errorTrue}
	<div style="position: fixed; bottom: 10px; left: 10px;z-index:100;">
		<InlineNotification
			lowContrast
			kind="error"
			title="ERROR:"
			subtitle={errorMessage}
		/>
	</div>
{/if}

<br />
<h1>Import Problems</h1>
<h4><strong>Please only import your own problems!</strong></h4>

<form on:submit|preventDefault style="padding: 20px;">
	<div>
		<label for="file-upload" class="custom-file-upload">
			&#8593 Upload .tex files for the problems
		</label>
		<input bind:files multiple type="file" id="file-upload" accept=".tex" />
	</div>

	<p style="margin-top: 20px;">Or manually add:</p>
	<TextArea
		bind:value={problemText}
		class="textArea"
		style="margin-left: 10%; margin-right: 10%;"
	/>
	<br />
	<Button action={manualAdd} title="Manually add" />

	{#if isAdmin && loadedUsers}
		<Select
			bind:selected={userSelectRef}
			labelText="User To Import As (leave default for yourself)"
		>
			<SelectItem value="" text="" />
			{#each allUsers as user}
				<SelectItem value={user.id} text={user.full_name} />
			{/each}
		</Select>
	{/if}

	<p style="margin-top: 20px;">
		{payloads.length} problems queued to be uploaded
	</p>

	<Button action={submitProblems} title="Import problems" />
</form>

{#if success}
	<p><strong>Successfully Imported Problems</strong></p>
{/if}

{#if errorMessages.length > 0}
	<p>
		Errors:<br />
		{#each errorMessages as err}
			{err}
		{/each}
	</p>
{/if}

<style>
	input[type="file"] {
		display: none;
	}
	.custom-file-upload {
		border: 2px solid var(--body);
		color: var(--body);
		display: inline-block;
		padding: 6px 12px;
		cursor: pointer;
		text-align: center;
		border-radius: 50px;
		font-weight: 500;
	}

	.custom-file-upload:hover {
		background-color: var(--body);
		color: var(--white);
	}

	:global(.bx--text-area:focus, .bx--text-area:active) {
		outline-color: var(--green) !important;
	}
</style>