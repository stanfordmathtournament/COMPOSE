import { supabase } from "../supabaseClient";
import { styles } from "$lib/scheme.json";

export let num_rounds = 9;
export let max_round_display = 8;
export let questions_per_round = 3;

// let team_lookup = {};
let points = [1, 2, 3, 4, 5, 6, 7, 8, 9];
let answer_data = {};

export async function getTeams() {
    const { data, error } = await supabase.from("teams").select("id");
    if (error) {
        throw error;
    }
    const teams = data.map((item) => item.id);
    return teams;
}

// async function downloadJSON() {
//     try {
//         const cacheBuster = new Date().getTime();
//         const { data, error } = await supabase.storage.from("guts").download(`guts_info.json?ts=${cacheBuster}`);
//         if (error) throw error;

//         const text = await data.text();
//         const json_data = JSON.parse(text);
//         const { team_lookup: team_lookup_new, answer_data: answer_data_new } = json_data;
//         team_lookup = team_lookup_new;
//         team_lookup = {...team_lookup}
//         answer_data = answer_data_new;
//         answer_data = {...answer_data}
//     } catch (error) {
//         console.error("Failed to download or parse JSON:", error);
//     }
// }

// export async function fillInTeams() {
//     await downloadJSON();
//     if (Object.values(answer_data).length == 0) {
//         answer_data["..."] = {};
//         for (let i = 1; i < num_rounds + 1; i++) {
//             answer_data["..."][i] = {};
//             for (let j = 1; j < questions_per_round + 1; j++) {
//                 answer_data["..."][i][j] = { value: "", correct: false };
//             }
//         }
//         answer_data["..."]["score"] = 0;

//         let teams = await getTeams();
//         for (let team of teams) {
//             await addResult(team)
//             answer_data[team] = {};
// 			for (let i = 1; i < num_rounds + 1; i++) {
// 				answer_data[team][i] = {};
// 				for (let j = 1; j < questions_per_round + 1; j++) {
// 					answer_data[team][i][j] = { value: "", correct: false };
// 				}
// 			}
// 			answer_data[team]["score"] = 0;
//         }
//     }
//     modifyAndUploadJson();
// }

// async function modifyAndUploadJson(): Promise<void> {
//     const updatedJsonData: any = { team_lookup, answer_data };
//     const updatedJsonString = JSON.stringify(updatedJsonData, null, 2);
    
//     const blob = new Blob([updatedJsonString], { type: 'application/json' });

//     // Download the file
//     const { data, error } = await supabase.storage.from("guts").upload("guts_info.json", blob, {
//         contentType: 'application/json',
//         upsert: true,
//     });

//     if (error) throw error;
// }

export async function getAnswerData() {
    let answer_data = {};
    const teams = await getTeams();
    const { data, error } = await supabase
        .from('guts')
        .select("team_id,round_num,answers,corrects")
    if (error) {
        throw error;
    }
    for (let team of teams) {
        answer_data[team] = {};
        for (let i = 1; i < num_rounds + 1; i++) {
            answer_data[team][i] = {};
            answer_data[team][i]["submitted"] = false;
            for (let j = 1; j < questions_per_round + 1; j++) {
                answer_data[team][i][j] = { value: "", correct: false };
            }
        }
    }
    console.log(answer_data);

    for (const entry of data) {
        const { team_id, round_num, answers, corrects } = entry;
        answer_data[team_id][round_num]["submitted"] = true;
        for (let j = 1; j < questions_per_round + 1; j++) {
            answer_data[team_id][round_num][j] = { value: answers[j - 1], correct: corrects[j - 1] };
        }
    }

    // for (let team of teams) {
    //     answer_data[team] = {};
    //     for (let i = 1; i < num_rounds + 1; i++) {
    //         console.log(`team: ${team}, round: ${i}`);
    //         answer_data[team][i] = {};
    //         const { data, error } = await supabase
    //             .from('guts')
    //             .select("answers, corrects")
    //             .eq("team_id", team)
    //             .eq("round_num", i)
    //         if (error) {    
    //             throw error;
    //         }
    //         if (data.length == 0) {
    //             answer_data[team][i]["submitted"] = false;
    //             for (let j = 1; j < questions_per_round + 1; j++) {
    //                 answer_data[team][i] = { value: "", correct: false };
    //             }
    //         } else {
    //             answer_data[team][i]["submitted"] = true;
    //             for (let j = 1; j < questions_per_round + 1; j++) {
    //                 answer_data[team][i][j] = { value: data[0].answers[j - 1], correct: data[0].corrects[j - 1] };
    //             }
    //         }
    //     }
    // }
    return answer_data;
}


export async function getStatus() {
    // await downloadJSON();
    // console.log(team_lookup)
    // let status: any[] = Object.values(team_lookup);
    // status = status.filter(a => a.team_name != `...`)
    // status.sort((a, b) => b.showing_score - a.showing_score);
    // return status;
    let status = [];
    let answer_data = await getAnswerData();
    const teams = await getTeams();
    for (let team of teams) {
        let score = 0;
        let showing_score = 0;
        let round_colors = [];
        for (let i = 1; i < num_rounds + 1; i++) {
            for (let j = 1; j < questions_per_round + 1; j++) {
                if (answer_data[team][i][j]["correct"]) {
                    score += points[i - 1];
                    if (j < max_round_display + 1) {
                        showing_score += points[i - 1];
                    }
                }
            }
            if (answer_data[team][i]["submitted"]) {
                round_colors[i] = styles["secondary"];
            } else {
                round_colors[i] = styles["background-dark"];
            }
        }
        status.push({ team_name: team, score: score, showing_score: showing_score, round_colors: round_colors });
    }
    status.sort((a, b) => b.showing_score - a.showing_score);
    return status;
}

// export async function addResult(team_name, round = 0, score = 0, showing_score = 0, add = false) {
// 	let newTeam = {
// 		team_name: team_name,
// 		score: score,
//         showing_score: showing_score,
// 	};
//     if (round == 0) {
//         for(let j = 0; j < num_rounds; j ++) {
//             newTeam[j + 1] = styles["background-dark"];
//         }
//     }
//     else {
//         for(let j = 0; j < num_rounds; j ++) {
//             newTeam[j + 1] = team_lookup[team_name][j+1];
//         }
//         if (add) {
//             newTeam[round] = styles["secondary"];
//         } else {
//             newTeam[round] = styles["background-dark"];
//         }
//     }
// 	team_lookup[team_name] = newTeam;
//     // await modifyAndUploadJson();
// };

// function calculate_score(team, max_round) {
//     let score = 0;
//     for (let i = 0; i < max_round; i ++) {
//         for(let j = 0; j < questions_per_round; j ++) { 
//             if (answer_data[team][i + 1][j + 1]["correct"]) {
//                 score += points[i];
//             }
//         }
//     }
//     return score;
// }

export async function clear(curr_team, round) {
    const { error } = await supabase
        .from("guts")
        .delete()
        .eq("team_id", curr_team)
        .eq("round_num", round)
    if (error) console.log('Error: ', error)
}

export async function submit(curr_team, round, round_data) {
    let corrects = [];
    let answers = [];
    for (let i = 1; i < questions_per_round + 1; i++) {
        corrects.push(round_data[i].correct);
        answers.push(round_data[i].value);
    }
    const { error } = await supabase
        .from("guts")
        .upsert([
            { team_id: curr_team, round_num: round, corrects: corrects, answers: answers}
        ], { onConflict: "team_id,round_num" },)

    if (error) console.log('Error: ', error)
}