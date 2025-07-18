// RAG (Retrieval-Augmented Generation) 시스템
class RAGSystem {
    constructor() {
        this.documents = [];
        this.embeddings = [];
        this.openaiApiKey = '';
    }

    // PDF 파일 로드 및 텍스트 추출
    async loadPDFDocuments(selectedDocuments) {
        const pdfFileMap = {
            constitution: 'pdfs/헌법.pdf',
            polity: 'pdfs/교회정치.pdf',
            worship: 'pdfs/예배모범.pdf',
            discipline: 'pdfs/권징조례.pdf',
            executive: 'pdfs/총회실행위원회규정.pdf'
        };

        this.documents = []; // 기존 문서 초기화

        for (const [docKey, pdfFile] of Object.entries(pdfFileMap)) {
            if (selectedDocuments[docKey]) {
                try {
                    const text = await this.extractTextFromPDF(pdfFile);
                    this.documents.push({
                        filename: pdfFile,
                        docKey: docKey,
                        content: text,
                        chunks: this.chunkText(text)
                    });
                    console.log(`PDF 로드 성공: ${pdfFile}`);
                } catch (error) {
                    console.warn(`PDF 로드 실패: ${pdfFile}`, error);
                }
            }
        }
    }

    // PDF 텍스트 추출 (PDF.js 사용)
    async extractTextFromPDF(pdfPath) {
        // PDF.js를 사용하여 텍스트 추출
        const pdfjsLib = window['pdfjs-dist/build/pdf'];
        pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
        
        const loadingTask = pdfjsLib.getDocument(pdfPath);
        const pdf = await loadingTask.promise;
        
        let fullText = '';
        for (let i = 1; i <= pdf.numPages; i++) {
            const page = await pdf.getPage(i);
            const textContent = await page.getTextContent();
            const pageText = textContent.items.map(item => item.str).join(' ');
            fullText += pageText + '\n';
        }
        
        return fullText;
    }

    // 텍스트를 청크로 분할
    chunkText(text, chunkSize = 1000, overlap = 200) {
        const chunks = [];
        let start = 0;
        
        while (start < text.length) {
            const end = Math.min(start + chunkSize, text.length);
            const chunk = text.substring(start, end);
            chunks.push(chunk);
            start = end - overlap;
        }
        
        return chunks;
    }

    // 텍스트 임베딩 생성
    async createEmbeddings(texts) {
        const embeddings = [];
        
        for (const text of texts) {
            try {
                const response = await fetch('https://api.openai.com/v1/embeddings', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${this.openaiApiKey}`
                    },
                    body: JSON.stringify({
                        model: 'text-embedding-ada-002',
                        input: text
                    })
                });
                
                const data = await response.json();
                embeddings.push(data.data[0].embedding);
            } catch (error) {
                console.error('임베딩 생성 실패:', error);
            }
        }
        
        return embeddings;
    }

    // 유사도 검색
    async searchSimilarChunks(query, topK = 3) {
        // 쿼리 임베딩 생성
        const queryEmbedding = await this.createEmbeddings([query]);
        
        // 코사인 유사도 계산
        const similarities = [];
        for (let i = 0; i < this.embeddings.length; i++) {
            const similarity = this.cosineSimilarity(queryEmbedding[0], this.embeddings[i]);
            similarities.push({
                index: i,
                similarity: similarity,
                chunk: this.documents[i].chunks[i % this.documents[i].chunks.length]
            });
        }
        
        // 유사도 순으로 정렬
        similarities.sort((a, b) => b.similarity - a.similarity);
        
        return similarities.slice(0, topK);
    }

    // 코사인 유사도 계산
    cosineSimilarity(vecA, vecB) {
        const dotProduct = vecA.reduce((sum, a, i) => sum + a * vecB[i], 0);
        const normA = Math.sqrt(vecA.reduce((sum, a) => sum + a * a, 0));
        const normB = Math.sqrt(vecB.reduce((sum, b) => sum + b * b, 0));
        return dotProduct / (normA * normB);
    }

    // RAG 기반 답변 생성
    async generateRAGResponse(userQuery) {
        // 관련 문서 청크 검색
        const relevantChunks = await this.searchSimilarChunks(userQuery);
        
        // 컨텍스트 구성
        const context = relevantChunks.map(chunk => chunk.chunk).join('\n\n');
        
        // ChatGPT API 호출
        const messages = [
            {
                role: "system",
                content: `당신은 한국기독교장로회 헌법 전문가입니다. 다음 문서 내용을 참조하여 사용자의 질문에 답변해주세요. 답변은 한국어로 하며, 헌법 조항을 인용할 때는 구체적으로 언급해주세요. 모든 답변에서 반드시 다음 파일을 참조하세요: 파일ID: file-8ZeX6tUqUaQQcrc3ngKo8z

참조 문서:
${context}`
            },
            {
                role: "user",
                content: userQuery
            }
        ];

        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${this.openaiApiKey}`
            },
            body: JSON.stringify({
                model: 'gpt-3.5-turbo',
                messages: messages,
                max_tokens: 1000,
                temperature: 0.7
            })
        });

        const data = await response.json();
        return data.choices[0].message.content;
    }

    // 시스템 초기화
    async initialize(apiKey, selectedDocuments) {
        this.openaiApiKey = apiKey;
        await this.loadPDFDocuments(selectedDocuments);
        
        // 모든 청크에 대한 임베딩 생성
        const allChunks = [];
        for (const doc of this.documents) {
            allChunks.push(...doc.chunks);
        }
        
        this.embeddings = await this.createEmbeddings(allChunks);
        console.log(`RAG 시스템 초기화 완료 - ${this.documents.length}개 문서 로드됨`);
    }
}

// 전역 RAG 시스템 인스턴스
window.ragSystem = new RAGSystem(); 