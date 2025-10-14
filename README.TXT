MeeM- prompt user guide:

**Installation**

1- If you don't have Node.js: Download and install from https://nodejs.org/
2-After installing Node.js, open (MeeM-prompt) folder and run (run.bat) file
3-go to AI model configuration tap and choose the type of model you will generate with , either gemini (online) with internet connection needed or ollama (local) with no internet conncection needed

in case of gemin follow these instruction :

How to Get Your API Key:
1-Go to Google AI Studio (https://aistudio.google.com/api-keys)
2-Click 'Get API key' in the top-right corner
3-Create a new API key or use an existing one
4-Copy and paste your API key here

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

*single image mode*

-In it you can insert one image for exterior architecture image and press refine attributes 

- you will have options to manipulate with like (style, time, openings ratio, etc...)

- after choosing the attributes, choose the model that you make the prompt for (chat gpt, imagine4, etc...)

- generate the prompt , so you will get the artistic prompt version and Json version 

-you can also modify the generated prompt by adding what changes you want in the text box above the generated prompt 

*Multi image mode* 

-In it you can upload starting from 1 to 4 images then enable mask icon that up and right corner in the image 

- draw your mask and write what you want from this image. I recommend to start with (analyze the ........in the image)

-press refine attributes, you will have options to manipulate with like (style, time, openings ratio, etc...)

- after choosing the attributes, choose the model that you make the prompt for (chat gpt, imagine4, etc...)

- generate the prompt , so you will get the artistic prompt version and Json version 

-you can also modify the generated prompt by adding what changes you want in the text box above the generated prompt 


*Text mode* 

-In it you can write a short description for the prompt you want 

- choose you attributes (optional)

- choose the model that you make the prompt for (chat gpt, imagine4, etc...)

-generate the prompt , so you will get the artistic prompt version and Json version 

-you can also modify the generated prompt by adding what changes you want in the text box above the generated prompt 

---Don't forget to follow me on Facebook, LinkedIn for future surprises and also give me the feedback for future versions that achieve your goals---

-Facebook profile:
https://www.facebook.com/mostafa.mohamed.368765/

-Linked in profile:
https://www.linkedin.com/in/mostafa-mohamed-b1a464306/

-Feedback link:
https://docs.google.com/forms/d/e/1FAIpQLSeZgFfZDSemW685YGc36TOdvW95YKN2ItFLn8dw9RMpRWn-Pw/viewform
