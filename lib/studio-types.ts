export type PairCard = {
 id:string;classId:number;groupId:number;pairNo:number;members:number;change:string;difference:string;
 verification:string;version:number;createdAt:string;updatedAt:string;canEdit:boolean;
};
export type Conclusion = {
 id:string;classId:number;groupId:number;choice:string;evidence:string[];reason:string;rewrite:string;
 uncertainty:string;version:number;updatedAt:string;canEdit:boolean;
};
export type Classroom = { classId:number;pairs:PairCard[];conclusions:Conclusion[];updatedAt:string };
export const stages = [
 { title:'個人練習', minutes:9, caption:'執行 V1 → 寫 V2 → 追問查證' },
 { title:'兩人比較', minutes:3, caption:'每人說明，再共同提交比較卡' },
 { title:'小組整合', minutes:4, caption:'閱讀全組卡片，提出有依據的結論' },
 { title:'教師回饋', minutes:2, caption:'分享不同做法與仍需查證的問題' }
];
export const v1 = '請說明南丁格爾與現代護理。';
export const referencePrompt = '請根據我提供的「南丁格爾與現代護理課堂重點卡」，向護理系大一新生說明三項貢獻與現代護理的關聯。請用三欄表格呈現：課堂提到的貢獻、與現代護理的關聯、護理新生可以學到什麼；三項貢獻各占一列，每格60字內。只能使用重點卡，請標明各項對應的重點；資料不足處標示「重點卡未提供，需查證」，不要自行補充事件、年份或文獻。';

