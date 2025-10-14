<img width="1920" height="1080" alt="Screenshot 2025-10-14 014556" src="https://github.com/user-attachments/assets/260fd866-219c-4c9f-84db-5f9af39da0a7" />


# MeeM-prompt-app #



MeeM-Prompt is the new cutting-edge tool that transforms the way architects and visualizers create prompts. With just a few clicks and simple options, what once felt like a complex, time-consuming task has become effortless. Now, generating professional-grade prompts for exterior architectural projects is faster, smarter, and easier than ever before!


No more headaches for prompt generation!!
🎉 The ultimate solution has arrived for the architects’ community and visualizers — bringing creativity, precision, and speed together like never before 😍✨
MeeM- prompt user guide:

**Installation**


1- If you don't have Node.js: Download and install from [https://nodejs.org/](https://nodejs.org/dist/v22.20.0/node-v22.20.0-x64.msi)

2- if you don't have git, download it from this link: https://github.com/git-for-windows/git/releases/download/v2.51.0.windows.2/Git-2.51.0.2-64-bit.exe 

3- install the git app

4- copy the repository url from the github page and open the folder you want to install the app then right click with mouse and open cmd (terminal prompt) write (git clone https://github.com/Mostafa-Mohamed-02/MeeM-prompt-app.git) then press enter

5- congrats! , you installed the app folder and ready to go 🎉🎉

6-open (MeeM-prompt) folder and run (run.bat) file


<img width="1658" height="904" alt="Screenshot 2025-10-14 015152" src="https://github.com/user-attachments/assets/1f592a88-e7e1-485e-95cd-a8570a7e3b20" />




7-go to AI model configuration tap and choose the type of model you will generate with , either gemini (online) with internet connection needed or ollama (local) with no internet conncection needed



in case of gemin follow these instruction :

How to Get Your API Key:

1-Go to Google AI Studio (https://aistudio.google.com/api-keys)

2-Click 'Get API key' in the top-right corner

3-Create a new API key or use an existing one

4-Copy and paste your API key here


![Untitled design](https://github.com/user-attachments/assets/b24ed6d6-c39f-44c2-94df-26359b14af62)



in case of ollama, follow these instructions: 




To connect to a local Ollama server, you must configure its CORS settings. Stop your server and restart it using the command for your OS:




For Windows:

1-Run (CMD)

2-Run: set OLLAMA_ORIGINS=*

3-Then, on the next line, run: ollama serve



This allows the web application to communicate with your local model.

-To get the Ollama model name from the models installed on your device:

1-Open a Command Prompt (CMD).

2-Run the command ollama list and press Enter.

3-From the listed models, copy the model name (for example: gemma3:4b). Make sure the model is a vision-capable model.

4-Paste the full model name into the empty "Model Name" box above.

5-Press the "Apply Model" button to apply the model to the app.




**Running**

By that you can go for the next step which is using the app

There is 3 modes :


<img width="1902" height="418" alt="Screenshot 2025-10-14 020329" src="https://github.com/user-attachments/assets/9e1a1dfd-8f0d-4dca-9315-b5f6d1d9cdfc" />



*single image mode*

- In it you can insert one image for exterior architecture image and press refine attributes


<img width="1889" height="982" alt="Screenshot 2025-10-14 020406" src="https://github.com/user-attachments/assets/f1ba6eb7-16e9-4555-9682-e5bcf1853dfa" />
<img width="1886" height="894" alt="Screenshot 2025-10-14 020436" src="https://github.com/user-attachments/assets/7b9d8989-8555-4e86-87bd-1cbd1d1ea0ed" />




- you will have options to manipulate with like (style, time, openings ratio, etc...)


<img width="1892" height="993" alt="Screenshot 2025-10-14 020805" src="https://github.com/user-attachments/assets/5f32f7d2-1a0e-472c-8783-01a8a0e3aff2" />



- after choosing the attributes, choose the model that you make the prompt for (chat gpt, imagine4, etc...)


<img width="1746" height="183" alt="Screenshot 2025-10-14 020829" src="https://github.com/user-attachments/assets/a2fe9e31-c8c7-4822-ab1c-193b7b1a876e" />



- generate the prompt , so you will get the artistic prompt version and Json version 

- you can also modify the generated prompt by adding what changes you want in the text box above the generated prompt



<img width="1887" height="996" alt="Screenshot 2025-10-14 020858" src="https://github.com/user-attachments/assets/55c51251-e569-44bf-9d4c-74e6d4b053f4" />




*Multi image mode* 

- In it you can upload starting from 1 to 4 images then enable mask icon that up and right corner in the image


<img width="1885" height="926" alt="Screenshot 2025-10-14 021020" src="https://github.com/user-attachments/assets/05c55568-5abd-4177-b9a8-ded8f27b1695" />



- draw your mask and write what you want from this image. I recommend to start with (analyze the ........in the image)


<img width="1890" height="982" alt="Screenshot 2025-10-14 021156" src="https://github.com/user-attachments/assets/41b8ab2b-9754-4659-a976-cbe1028d723a" />



- press refine attributes, you will have options to manipulate with like (style, time, openings ratio, etc...)

- after choosing the attributes, choose the model that you make the prompt for (chat gpt, imagine4, etc...)

- generate the prompt , so you will get the artistic prompt version and Json version 

- you can also modify the generated prompt by adding what changes you want in the text box above the generated prompt 


*Text mode* 


<img width="1890" height="994" alt="Screenshot 2025-10-14 021319" src="https://github.com/user-attachments/assets/2ceaf522-b169-4b61-bf7a-289565a6124a" />



- In it you can write a short description for the prompt you want


<img width="1056" height="404" alt="Screenshot 2025-10-14 021403" src="https://github.com/user-attachments/assets/1d32e675-380c-4a15-8748-4a55a1655786" />



- choose you attributes (optional)


<img width="1828" height="832" alt="Screenshot 2025-10-14 021442" src="https://github.com/user-attachments/assets/190abbc1-9211-41c1-85da-74b9f401e1f1" />



- choose the model that you make the prompt for (chat gpt, imagine4, etc...)


<img width="1804" height="962" alt="Screenshot 2025-10-14 021531" src="https://github.com/user-attachments/assets/38e4ec77-81d3-4057-b420-f56a132ef733" />



- generate the prompt , so you will get the artistic prompt version and Json version 

- you can also modify the generated prompt by adding what changes you want in the text box above the generated prompt 

---Don't forget to follow me on Facebook, LinkedIn for future surprises and also give me the feedback for future versions that achieve your goals---


<img width="1894" height="206" alt="Screenshot 2025-10-14 021619" src="https://github.com/user-attachments/assets/607f08f4-2063-40ef-b7ed-5226ced35f3b" />

<img width="1786" height="113" alt="Screenshot 2025-10-14 021639" src="https://github.com/user-attachments/assets/a6455f14-b3ec-4b6d-90d7-c3b6a95e948b" />


