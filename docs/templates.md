# Templates Reference

Extracted from the Trello board export. 11 active templates.

Notes on mapping to our data model:
- Trello has two-level hierarchy: checklists (phases) -> items (tasks). We flatten into a single task list per template.
- Trello has no explicit offset days. We derive them from checklist ordering and timing hints in task names (e.g., "one week before", "2 weeks before").
- Many tasks reference Google Docs process documents via markdown links - these map to `instructionsUrl`.
- Some tasks mention specific assignees (e.g., "– Valeriia", "– Alexey") - these map to per-task `assigneeId`.
- Checklist names become phase groupings - useful for understanding the workflow but flattened in our model.

---

## 1. Newsletter

- Trello name: `📰 [Newsletter] Weekly email #XXX (DD MMM YYYY) -sponsored -book-of-the-week`
- Type: newsletter
- Display:
  - Emoji: 📰
  - Tags: Newsletter
  - Title: Weekly email #XXX
- Anchor date: Newsletter publish day
- Trigger: automatic, weekly. Create bundle 14 days before publish day (sponsor needs 2 weeks lead time)

Weekly newsletter published via MailChimp. Includes sponsored content, book of the week feature, event announcements, podcast highlights, and articles.

Links (pre-defined for each bundle):
- Sponsorship document
- Mailchimp newsletter link
- LinkedIn link
- X link

Overview docs:
- [Process documents](https://docs.google.com/document/d/1FEmQV8myR3jN-8_kCG_tQh4jrrxFZJPpRag9iPf_RII/edit)
- [Newsletter](https://docs.google.com/document/d/10sqvW0RqHJ2xQaoJQB0Ce0E21QPPAef5UwWrx0aT2XA/edit)

Phases & tasks (15 tasks across 5 checklists):

1. Get the content from sponsors
   - Create sponsorship document
     - instructions: https://docs.google.com/document/d/1N3tLKK1oDpRep1R5uZ5hhy9b9pDPi21qI_cO44vO7W8/edit
   - Email the sponsor with the sponsorship document - add Valeriia in communication [milestone: -14d]
     - instructions: https://docs.google.com/document/d/1cgUOAdSp9eqad4MUiEdFBCEb3v0PSB3DiCeYzcJrsrs/edit

2. Create a new newsletter edition
   - Create a MailChimp campaign
     - instructions: https://docs.google.com/document/d/1QUz5pZUShGxFzPGAjdauYJffBhgcH1fUVScG_MlToOQ/edit
   - Fill up "Sponsored" block (after sponsorship document is completed)
     - instructions: https://docs.google.com/document/d/1kuuUAZl0TBlc9jgzH99GxJ9zGGqwDrTZeMzuIlqDKiA/edit

3. Ping Valeriia to fill her blocks (assignee: Valeriia)
   - Fill up "Book of the week" block
     - instructions: https://docs.google.com/document/d/10y0CCq8ApFbH1Mx7wlh_b_ZudnPib9qk_tDysA99xNg/edit
   - Fill up "Event" block
     - instructions: https://docs.google.com/document/d/1QUz5pZUShGxFzPGAjdauYJffBhgcH1fUVScG_MlToOQ/edit
   - Fill up "Podcast" block
     - instructions: https://docs.google.com/document/d/1Q6eKmPKAa7LE8-HZrKV9NOdCJLOwlIqB0Txo6aFZUbg/edit
   - Fill up "Article" block
     - instructions: https://docs.google.com/document/d/1QUz5pZUShGxFzPGAjdauYJffBhgcH1fUVScG_MlToOQ/edit
   - Schedule Email Newsletter
     - instructions: https://docs.google.com/document/d/1hY7nMMRqooMpmCV0gl0aNfAePUajYLyylW0JUTdiwEM/edit

4. Schedule sponsored social media posts
   - Create an Invoice
     - instructions: https://docs.google.com/document/d/1PeLSKvs76XiP-bG4WviQur4pQS0Ie25w9I50CZkJYZs/edit
   - Send email to notify sponsor that publication is live
     - instructions: https://docs.google.com/document/d/1mIm41ciFJ4aF0lUKbJzbeD_dF7vF-gqEti-vQOJ_mTQ/edit
   - Schedule Sponsorship content on LinkedIn
     - instructions: https://docs.google.com/document/d/1pHfmmVGnNKGM4i0um3M5yqpgZJlb6sgHGl0eZ1abW-A/edit
   - Schedule Sponsorship content on Twitter
     - instructions: https://docs.google.com/document/d/18Pm55ewbv1FoO4Cz_Dx-vWICPa0QhgrXiEsvZX7b6DQ/edit

5. Measure newsletter performance
   - Add newsletter performance on the spreadsheet [milestone: +7d]
     - instructions: https://docs.google.com/document/d/1A4bsGDNh4MP8WPsrTAo2hVJvlfQNKth9O0q55Xnf0oI/edit
   - Send the performance of the newsletter to the sponsor [milestone: +7d]
     - instructions: https://docs.google.com/document/d/1oXpq9SlHHcSe5JjDrScPT2yVb4n980uTJX_-F6NNqkU/edit

---

## 2. Book of the Week

- Trello name: `📚 [Book of the Week] YYYY-MM-DD - Book - Author(s)`
- Type: book-of-the-week
- Display:
  - Emoji: 📚
  - Tags: Book of the Week
  - Title: Book - Author(s)
- Anchor date: Monday of event week (Mon-Fri)
- Trigger: manual. Created when a book author agrees to participate and a date is confirmed

Weekly book feature where authors answer community questions and winners receive free copies. Runs Monday through Friday of the event week.

Links (pre-defined for each bundle):
- Guest email
- Publisher link
- Website link

Overview docs:
- [Process documents](https://docs.google.com/document/d/1FEmQV8myR3jN-8_kCG_tQh4jrrxFZJPpRag9iPf_RII/edit)
- [Events](https://docs.google.com/document/d/1SVWxBsBzvG5URX2tWD9M9HRfI11c2eq3Z7TMt0-JHqQ/edit)
- [Events (slack) - book of the week](https://docs.google.com/document/d/1RdxwuKVGRI69phmPbmJbgoO3o8il52LFZhiUu3qaDME/edit)

Phases & tasks (20 tasks across 7 checklists):

1. Reach out
   - Reach out to book authors
     - instructions: https://docs.google.com/document/d/1rGXg_1qbCmJUQpVxW9w12-BZObWaFBnTEr98eoMAJkk/edit
   - Agree on a date
     - instructions: https://docs.google.com/document/d/1VC0nV7NVvKw5XaK9xYlLESystohHaaOthgIdyAmBJEo/edit
   - Change the status to "confirmed" in the schedule spreadsheet

2. Fill in the Airtable form
   - Fill up the Airtable form for each author of the book
     - instructions: https://docs.google.com/document/d/1PaX3fYo7grHvQ2d7Mw1LBXZidJmFXqJ6ttk-DUeLNXM/edit
   - Fill up the Airtable form for the book
     - instructions: https://docs.google.com/document/d/11S7hjpIV0N3MnVm75ygBfwqB9c9_huRLaHil9Zzx_xY/edit
   - Create a web page from the forms
     - instructions: https://docs.google.com/document/d/16hYJcuuEiG4nKS123_w95eaX3tcBqn6HgneXl0G9szY/edit

3. Reach out again
   - Announce the event on DTC LinkedIn [milestone: -7d]
   - Remind the author about the event [milestone: -7d]
     - instructions: https://docs.google.com/document/d/1OuOW7IrYQYUS4UK3GBJZRWVIgqW9fp_rkp5hw2bwbjY/edit
   - Ask book authors to share the event page
     - instructions: https://docs.google.com/document/d/1wnyMlIO3MuW7TwXkX6NYyo7XXp1hKM_lsp9KUgslSpg/edit

4. Social media announcements
   - Announce the book of the week event on DTC LinkedIn [milestone: anchor, Tuesday of event week]
     - instructions: https://docs.google.com/document/d/1HeorFgnMhVt2olNGYJNpoeht_-av-G-nFEf7NLKL8Ek/edit
   - Comment from Alexey's account on LinkedIn (assignee: Alexey)
   - Announce the book of the week event on DTC Twitter
     - instructions: https://docs.google.com/document/d/1VCRVVhI7Lo4OOAg7Blkab94gyoJrjNRgBVKw3tjbxW4/edit

5. Slack
   - Invite the author(s) to Slack
     - instructions: https://docs.google.com/document/d/1G8XBXPTQpX8nf873TQmNpkFee3mDueGoVvPGcE54Eho/edit
   - Schedule the announcement in Slack
     - instructions: https://docs.google.com/document/d/1yf1f8ZLzePv-bFHjTlXmLydEzxGpuIG38BJwkqxAMbI/edit
   - Announce the book in the #book-of-the-week and #announcements channel [milestone: anchor, Monday of event week]

6. Winners
   - Authors answer questions
   - Select winners (ask author) [milestone: +4d, Friday of event week]
     - instructions: https://docs.google.com/document/d/1S2CwgVZ9-7v_-9HIMk2CdODlkNqMejxqCOcs2bEo9G8/edit
   - Collect the emails from winners
     - instructions: https://docs.google.com/document/d/14QzlXTP1FLHnNAn_ZyTGKlsst-H_hZKSnurzTy8D9TY/edit
   - Announce the book-of-the-week winners in the Slack community
     - instructions: https://docs.google.com/document/d/1JxtqGk1UamUGp3PxtD3-YCJJagJdJK00CGBEPVd4VH8/edit
   - Contact the publisher or the authors and give them the emails
     - instructions: https://docs.google.com/document/d/1szidymIamDfTI0LpkmwlRz7AX0qsRcPEVrcKtaFz_hs/edit

7. Other
   - Fill in the newsletter announcement (assignee: Valeriia)
     - instructions: https://docs.google.com/document/d/10y0CCq8ApFbH1Mx7wlh_b_ZudnPib9qk_tDysA99xNg/edit

---

## 3. Podcast

- Trello name: `🎙️ [Podcast] 2026-MMM-DD - Topic - Name`
- Type: podcast
- Display:
  - Emoji: 🎙️
  - Tags: Podcast
  - Title: Topic - Name
- Anchor date: Live stream date
- Trigger: manual. Created when a podcast guest agrees and a stream date is confirmed

Live podcast recording streamed on YouTube, then edited and published to Spotify and Apple Podcasts. Most complex template with 40 tasks.

Links (pre-defined for each bundle):
- Guest email
- Podcast document
- Luma link
- Meetup link
- Youtube link
- Transcription
- Spotify for podcasters link
- Spotify podcast link
- Apple podcasts link
- DTC webpage podcast link

Overview docs:
- [Process documents](https://docs.google.com/document/d/1FEmQV8myR3jN-8_kCG_tQh4jrrxFZJPpRag9iPf_RII/edit)
- [Events](https://docs.google.com/document/d/1SVWxBsBzvG5URX2tWD9M9HRfI11c2eq3Z7TMt0-JHqQ/edit)
- [Events (live) - podcast](https://docs.google.com/document/d/19d_kBOVQJ2p5qZCtGywzWzYeyCv5FWeHApZnEUZIYRg/edit)

Phases & tasks (40 tasks across 10 checklists):

1. Reach out to guest and agree
   - Obtain speaker's email
   - Create a proposed calendar invite for guest speaker
     - instructions: https://docs.google.com/document/d/1USXNWAriIlK_AmbHSIR0qt3e0RC0aJh8GCSUJbq7-5k/edit
   - Agree on a date
     - instructions: https://docs.google.com/document/d/1USXNWAriIlK_AmbHSIR0qt3e0RC0aJh8GCSUJbq7-5k/edit

2. Document for the podcast
   - Create a podcast document with the questions
     - instructions: https://docs.google.com/document/d/1IVNQQs-Hk-8LzZWox8YWbShJ6Y3sl47H5Z2PC2ra9ZU/edit
   - Include Johanna and ask the guest their biography and other information
     - instructions: https://docs.google.com/document/d/1Ix73NmCJPfYs0HcokxG5sORj0bFxtZsLrZTLHsp_DDM/edit
   - Add the Guest as an Editor on the podcast document
   - Share the podcast document on the #dtc-podcast-help
     - instructions: https://docs.google.com/document/d/1pVL13ku-_zwlqQk8PhmxJkxnRylxzDIKImlzH526k1M/edit
   - Create a calendar invite for guest speaker
     - instructions: https://docs.google.com/document/d/1K-1a2EWm6TwyogSiQ4MxuDB_1nqMBwOiRmJ97dlkMjs/edit
   - Add a guest bio to the podcast document
     - instructions: https://docs.google.com/document/d/1mijZcQ6qRXCscG0DVx6UA9KGgUT_QVTDUSWpQl4aqhE/edit
   - Fill in the "people" form in Airtable
     - instructions: https://docs.google.com/document/d/1PaX3fYo7grHvQ2d7Mw1LBXZidJmFXqJ6ttk-DUeLNXM/edit

3. Event creation
   - Create a banner for a podcast event in Figma
     - instructions: https://docs.google.com/document/d/1z4Uj2GTF9Aq4Dp_Qz_F0UoCFAIYaiFo0h8JEvboz2PI/edit
   - Create an event in Luma
     - instructions: https://docs.google.com/document/d/1GbDNYXnA5m-ZQkaRkvQw_NwqDg7m7sSad_vCFUM0Ln8/edit
   - Create an event in Meetup
     - instructions: https://docs.google.com/document/d/1PsxqVk2bm7uhQiD-KbFOiUiiLQmstjT3G97ldnKRlrs/edit
   - Check Meetup if the location is online with the YouTube link
     - instructions: https://docs.google.com/document/d/1PsxqVk2bm7uhQiD-KbFOiUiiLQmstjT3G97ldnKRlrs/edit
   - Create event in the DTC community Calendar
     - instructions: https://docs.google.com/document/d/1HwptQpp9w_TihEf7szGL130eSorzY_e_K4jSzAG-rAE/edit
   - Announce event in Slack in #announcements
     - instructions: https://docs.google.com/document/d/1rDHHbtDlkWdzIuD7Nig1ZmNRl6x7RGY7nV4U0YKCbLQ/edit
   - Fill in the "event" form in Airtable
     - instructions: https://docs.google.com/document/d/1DEpKCmIGwoOE-erFoUrH6hSO2TB9wcDgZF_S1I395Q8/edit
   - Add the event to the DataTalks.Club webpage
     - instructions: https://docs.google.com/document/d/16hYJcuuEiG4nKS123_w95eaX3tcBqn6HgneXl0G9szY/edit
   - Schedule posts on LinkedIn and Twitter
     - instructions: https://docs.google.com/document/d/12Af_uNfrZ4VhjGLRAGm-NzvzCc5dfAG1j9GAaHpZtD0/edit

4. Remind the guest
   - Remind the guest about the event [milestone: -7d]
     - instructions: https://docs.google.com/document/d/1dYqSx7766nWPyj7ROI_NsMsJiXsUT1Q9dhUmNFXCRFA/edit
   - Remind the guest about the event [milestone: -1d]
     - instructions: https://docs.google.com/document/d/1JSHCMgOufo0UrUD2XE1D4rLc1H0jROTjZB9ARCGeZrk/edit

5. Actual stream [milestone: anchor]
   - Actual stream

6. YouTube video editing
   - Upload the recording to the shared folder in dropbox (assignee: Alexey)
   - Update the cover of the YouTube video
     - instructions: https://docs.google.com/document/d/1pRxR7z_XUey3LVcbjmD4_vCEuH4XxdfhAUAZFoJSlgw/edit
   - Remove the beginning of the recording
     - instructions: https://docs.google.com/document/d/1lk98y-hzTq8tczukByjA_yllfaggO_6a9hw38x20LJ8/edit
   - Recheck the video if the edit is successful
   - Create the transcript document
     - instructions: https://docs.google.com/document/d/1lkvu5T4fVT0nnmjIPolLCT4o4dUc3iZ2b7jWycVrtPU/edit
   - Add the video to "livestream" and "podcast" playlists on YouTube
     - instructions: https://docs.google.com/document/d/1wj9PWXhYqWopZMzZX4POucoMECoBDCu4I8irbR88qk8/edit
   - Add the YouTube link of the stream to the website
     - instructions: https://docs.google.com/document/d/1JFtFaNqYVEZ0aP4AsIeUDSriN9WzBdg09D53mDPWqUw/edit
   - Edit video description
     - instructions: https://docs.google.com/document/d/1nQQ0wXRuqqVJ5L4CL9xvkHnoAFDxBDld86sj3_LvZ5A/edit
   - Include timecodes extracted from the transcription
     - instructions: https://docs.google.com/document/d/1RrTDKmxs9iN2YKnYQ9uSQvdUXRGxPJJ3u7RiQWnCyCw/edit
   - Ask the guest for links after the stream
     - instructions: https://docs.google.com/document/d/1tsuI291-eJ8CxK5MHajEKK3ODZ_TOHfX-XZ-csAFX8Y/edit

7. Podcast page
   - Schedule the edited podcast episode with Spotify for Podcasters
     - instructions: https://docs.google.com/document/d/1moSrrDw501TzG3X_DqreK2ZkhRZ40I_d9lCjhF4agQA/edit
   - Moving Podcast Audio in Dropbox
     - instructions: https://docs.google.com/document/d/1PTfM18NgBRICm70hPMcYntCEs_uNxh0lYERhmDcusGA/edit
   - Add a podcast episode via Airtable form
     - instructions: https://docs.google.com/document/d/1nUvqLRX18fEWgqeJO-9FNuXDX8SBZpjauIjvfXwaL4k/edit
   - Create a podcast page with the information from the form
     - instructions: https://docs.google.com/document/d/16hYJcuuEiG4nKS123_w95eaX3tcBqn6HgneXl0G9szY/edit

8. Reach out to guest after event
   - Ask the guest to share the podcast page
     - instructions: https://docs.google.com/document/d/1ojQTnenw5yfKL_hn4LCDzfbVRcNxbvNFfEO_1PiIbDQ/edit

9. Other tasks
   - Move the podcast documents to archive in google drive
     - instructions: https://docs.google.com/document/d/1wEs9firI_tlbSNt4jPWTAgTZT1_eaQ6P9VSoDoybu48/edit
   - Upload the emails from Luma to Mailchimp
     - instructions: https://docs.google.com/document/d/1xyan3b3IdWdOnUZ93qbxpLY6lI9GjiUqzBRUJ1TmzeQ/edit
   - Add the podcast webpage to the newsletter (assignee: Valeriia)
     - instructions: https://docs.google.com/document/d/1Q6eKmPKAa7LE8-HZrKV9NOdCJLOwlIqB0Txo6aFZUbg/edit

10. Social media posts
    - Schedule posts "overview after the event" on LinkedIn and Twitter
      - instructions: https://docs.google.com/document/d/1156ty59e3ZlUW3nPpMTd_2smzW40v0ANt9nojUxZ2Gc/edit
    - Schedule posts "Guest recommendations" on LinkedIn and Twitter [milestone: +7d]
      - instructions: https://docs.google.com/document/d/1XDOfmUHMjKdtlImd5C5LGalCWD8tChefCbB_dtskfWs/edit

---

## 4. Webinar

- Trello name: `📺 [Webinar] 2026-MMM-DD - Topic - Speaker`
- Type: webinar
- Display:
  - Emoji: 📺
  - Tags: Webinar
  - Title: Topic - Speaker
- Anchor date: Live stream date
- Trigger: manual. Created when a webinar speaker agrees and a stream date is confirmed

Live webinar streamed on YouTube. Similar workflow to podcast but without the podcast-specific publishing steps.

Links (pre-defined for each bundle):
- Guest email
- Luma link
- Meetup link
- Youtube Link

Overview docs:
- [Process documents](https://docs.google.com/document/d/1FEmQV8myR3jN-8_kCG_tQh4jrrxFZJPpRag9iPf_RII/edit)
- [Events](https://docs.google.com/document/d/1SVWxBsBzvG5URX2tWD9M9HRfI11c2eq3Z7TMt0-JHqQ/edit)
- [Events (live) - webinar](https://docs.google.com/document/d/1x7MJa_K0ZmuWw5NkTbmUFM9welTD8j86evcRl1c7VtY/edit)

Phases & tasks (28 tasks across 9 checklists):

1. Reach out to guest
   - Initial contact with the speaker asking for details
     - instructions: https://docs.google.com/document/d/1Hfz6KIIVKDL98t1j0_erGs0RAYCBnJdRjuuFfAxYxHg/edit
   - Agree on a date
     - instructions: https://docs.google.com/document/d/1USXNWAriIlK_AmbHSIR0qt3e0RC0aJh8GCSUJbq7-5k/edit
   - Create a calendar invite for the guests
     - instructions: https://docs.google.com/document/d/1K-1a2EWm6TwyogSiQ4MxuDB_1nqMBwOiRmJ97dlkMjs/edit
   - Get information about the event: title, subtitle, outline
     - instructions: https://docs.google.com/document/d/1mTTgEphnqkUNd9Ilf6lIGgT9q61Sbt4BCJOEWVSio9Q/edit
   - Fill in the "people" form in Airtable
     - instructions: https://docs.google.com/document/d/1PaX3fYo7grHvQ2d7Mw1LBXZidJmFXqJ6ttk-DUeLNXM/edit

2. Event creation
   - Create a banner for a webinar event in Figma
     - instructions: https://docs.google.com/document/d/1z4Uj2GTF9Aq4Dp_Qz_F0UoCFAIYaiFo0h8JEvboz2PI/edit
   - Create events on Luma
     - instructions: https://docs.google.com/document/d/1GbDNYXnA5m-ZQkaRkvQw_NwqDg7m7sSad_vCFUM0Ln8/edit
   - Create events on Meetup
     - instructions: https://docs.google.com/document/d/1PsxqVk2bm7uhQiD-KbFOiUiiLQmstjT3G97ldnKRlrs/edit
   - Check Meetup if the location is online with the YouTube link
   - Create events on LinkedIn
     - instructions: https://docs.google.com/document/d/1ZwnCpleU0xQqZV02KVNSO24gu8HIHIrZdbHLGnZx52k/edit
   - Create event in Calendar
     - instructions: https://docs.google.com/document/d/1HwptQpp9w_TihEf7szGL130eSorzY_e_K4jSzAG-rAE/edit
   - Fill in the "event" form in Airtable
     - instructions: https://docs.google.com/document/d/1DEpKCmIGwoOE-erFoUrH6hSO2TB9wcDgZF_S1I395Q8/edit
   - Add the event to the DataTalks.Club webpage
     - instructions: https://docs.google.com/document/d/16hYJcuuEiG4nKS123_w95eaX3tcBqn6HgneXl0G9szY/edit
   - Send Luma link to Valeriia for newsletter

3. Announce
   - Announce event in Slack
     - instructions: https://docs.google.com/document/d/1rDHHbtDlkWdzIuD7Nig1ZmNRl6x7RGY7nV4U0YKCbLQ/edit
   - Schedule posts on LinkedIn and Twitter
     - instructions: https://docs.google.com/document/d/12Af_uNfrZ4VhjGLRAGm-NzvzCc5dfAG1j9GAaHpZtD0/edit

4. Remind the guest
   - Remind the guest about the event [milestone: -7d]
     - instructions: https://docs.google.com/document/d/1dYqSx7766nWPyj7ROI_NsMsJiXsUT1Q9dhUmNFXCRFA/edit
   - Remind the guest about the event [milestone: -1d]
     - instructions: https://docs.google.com/document/d/1rMvF296VSzgMvw5Pmy0azE374ZaRHSak2yXVxJGyyTU/edit

5. Actual stream [milestone: anchor]
   - Actual stream

6. YouTube video editing
   - Update the cover of the YouTube video
     - instructions: https://docs.google.com/document/d/1pRxR7z_XUey3LVcbjmD4_vCEuH4XxdfhAUAZFoJSlgw/edit
   - Remove the beginning of the recording
     - instructions: https://docs.google.com/document/d/1lk98y-hzTq8tczukByjA_yllfaggO_6a9hw38x20LJ8/edit
   - Recheck the video if the edit is successful
   - Generate Timecodes Using Youtube Video Transcripts
     - instructions: https://docs.google.com/document/d/1nQQ0wXRuqqVJ5L4CL9xvkHnoAFDxBDld86sj3_LvZ5A/edit
   - Adding timecodes to YouTube videos
     - instructions: https://docs.google.com/document/d/1csT9bIvr8WNz3anuS-fO_WrIHvln2P3Hcsh7P0t-lOc/edit
   - Add the video to "livestream" and "webinar" playlists on YouTube
     - instructions: https://docs.google.com/document/d/1wj9PWXhYqWopZMzZX4POucoMECoBDCu4I8irbR88qk8/edit
   - Add the YouTube link of the stream to the website
     - instructions: https://docs.google.com/document/d/1JFtFaNqYVEZ0aP4AsIeUDSriN9WzBdg09D53mDPWqUw/edit

7. Emails
   - Upload the emails from Luma to Mailchimp
     - instructions: https://docs.google.com/document/d/1xyan3b3IdWdOnUZ93qbxpLY6lI9GjiUqzBRUJ1TmzeQ/edit
   - For sponsored events - share the list with emails with the sponsor
     - instructions: https://docs.google.com/document/d/1qf38niJVSAFYz0hkTXVma_bvM9EpArQLUD4wF4YB_Ok/edit

8. Reach out to speaker after event
   - Ask for speaker recommendations and ask the guest to share the video
     - instructions: https://docs.google.com/document/d/1KuKKupkYHs6V5rdEhbpblIJ2zQcHPJrdauFANX_kA0o/edit
   - Add links from the speaker to the YouTube video
     - instructions: https://docs.google.com/document/d/1wj9PWXhYqWopZMzZX4POucoMECoBDCu4I8irbR88qk8/edit

9. Other tasks
   - Fill in the newsletter announcement (assignee: Valeriia)
   - Publish social media announcement

---

## 5. Workshop

- Trello name: `🔧 [Workshop] 2026-MMM-DD - Title - Name`
- Type: workshop
- Display:
  - Emoji: 🔧
  - Tags: Workshop
  - Title: Title - Name
- Anchor date: Live stream date
- Trigger: manual. Created when a workshop speaker agrees and a stream date is confirmed

Live workshop streamed on YouTube. Can be sponsored. Similar to webinar but includes workshop document creation and potential sponsorship handling.

Links (pre-defined for each bundle):
- Workshop document
- Guest email
- Luma link
- Meetup link
- Linkedin link
- Youtube Link

Overview docs:
- [Process documents](https://docs.google.com/document/d/1FEmQV8myR3jN-8_kCG_tQh4jrrxFZJPpRag9iPf_RII/edit)
- [Events](https://docs.google.com/document/d/1SVWxBsBzvG5URX2tWD9M9HRfI11c2eq3Z7TMt0-JHqQ/edit)
- [Events (live) - workshop](https://docs.google.com/document/d/1tbOClURp1j3MolPY5cI9HzA0QUi8rkXWU_M69RP5BcY/edit)

Phases & tasks (30 tasks across 9 checklists):

1. Reach out to guest and agree
   - Initial contact with the speaker asking for details
     - instructions: https://docs.google.com/document/d/1mTTgEphnqkUNd9Ilf6lIGgT9q61Sbt4BCJOEWVSio9Q/edit
   - Agree on a date
   - Create a Workshop Document
   - Create calendar invites for workshops
     - instructions: https://docs.google.com/document/d/1K-1a2EWm6TwyogSiQ4MxuDB_1nqMBwOiRmJ97dlkMjs/edit
   - Get information about the event: title, subtitle, outline
     - instructions: https://docs.google.com/document/d/1mTTgEphnqkUNd9Ilf6lIGgT9q61Sbt4BCJOEWVSio9Q/edit
   - Fill in the "people" form in Airtable
     - instructions: https://docs.google.com/document/d/1PaX3fYo7grHvQ2d7Mw1LBXZidJmFXqJ6ttk-DUeLNXM/edit

2. Event creation
   - Create a banner for a workshop event in Figma
     - instructions: https://docs.google.com/document/d/1z4Uj2GTF9Aq4Dp_Qz_F0UoCFAIYaiFo0h8JEvboz2PI/edit
   - Create events on Luma
     - instructions: https://docs.google.com/document/d/1GbDNYXnA5m-ZQkaRkvQw_NwqDg7m7sSad_vCFUM0Ln8/edit
   - Create events on Meetup
     - instructions: https://docs.google.com/document/d/1PsxqVk2bm7uhQiD-KbFOiUiiLQmstjT3G97ldnKRlrs/edit
   - Check Meetup if the location is online with the YouTube link
   - Create events on LinkedIn
     - instructions: https://docs.google.com/document/d/1ZwnCpleU0xQqZV02KVNSO24gu8HIHIrZdbHLGnZx52k/edit
   - Create event in Calendar
     - instructions: https://docs.google.com/document/d/1HwptQpp9w_TihEf7szGL130eSorzY_e_K4jSzAG-rAE/edit
   - Fill in the "event" form in Airtable
     - instructions: https://docs.google.com/document/d/1DEpKCmIGwoOE-erFoUrH6hSO2TB9wcDgZF_S1I395Q8/edit
   - Add the event to the DataTalks.Club webpage
     - instructions: https://docs.google.com/document/d/16hYJcuuEiG4nKS123_w95eaX3tcBqn6HgneXl0G9szY/edit
   - Send Luma link to Valeriia for newsletter

3. Announce
   - Announce event in Slack in #announcements
     - instructions: https://docs.google.com/document/d/1rDHHbtDlkWdzIuD7Nig1ZmNRl6x7RGY7nV4U0YKCbLQ/edit
   - Announce event on different communities [milestone: -1d]
     - instructions: https://docs.google.com/document/d/1VWitGUErmKn8JfzBEYx3BVa-lSl-tLPB2bLDtPFWi9Q/edit
   - Schedule posts on LinkedIn and Twitter
     - instructions: https://docs.google.com/document/d/12Af_uNfrZ4VhjGLRAGm-NzvzCc5dfAG1j9GAaHpZtD0/edit

4. Remind the guest
   - Prepare and send an Invoice for Sponsored Workshop
     - instructions: https://docs.google.com/document/d/1PeLSKvs76XiP-bG4WviQur4pQS0Ie25w9I50CZkJYZs/edit
   - Remind the guest about the event [milestone: -7d]
     - instructions: https://docs.google.com/document/d/1dYqSx7766nWPyj7ROI_NsMsJiXsUT1Q9dhUmNFXCRFA/edit
   - Remind the guest about the event [milestone: -1d]
     - instructions: https://docs.google.com/document/d/1rMvF296VSzgMvw5Pmy0azE374ZaRHSak2yXVxJGyyTU/edit

5. Actual stream [milestone: anchor]
   - Actual stream

6. YouTube video editing
   - Update the cover of the YouTube video
     - instructions: https://docs.google.com/document/d/1pRxR7z_XUey3LVcbjmD4_vCEuH4XxdfhAUAZFoJSlgw/edit
   - Remove the beginning of the recording
     - instructions: https://docs.google.com/document/d/1lk98y-hzTq8tczukByjA_yllfaggO_6a9hw38x20LJ8/edit
   - Recheck the video if the edit is successful
   - Generate Timecodes Using Youtube Video Transcripts
     - instructions: https://docs.google.com/document/d/1nQQ0wXRuqqVJ5L4CL9xvkHnoAFDxBDld86sj3_LvZ5A/edit
   - Adding timecodes to YouTube videos
     - instructions: https://docs.google.com/document/d/1csT9bIvr8WNz3anuS-fO_WrIHvln2P3Hcsh7P0t-lOc/edit
   - Add the video to "livestream" and "workshop" playlists on YouTube
     - instructions: https://docs.google.com/document/d/1wj9PWXhYqWopZMzZX4POucoMECoBDCu4I8irbR88qk8/edit
   - Add the YouTube link of the stream to the website
     - instructions: https://docs.google.com/document/d/1JFtFaNqYVEZ0aP4AsIeUDSriN9WzBdg09D53mDPWqUw/edit

7. Social Media Posts after event
   - Publish Social Media Announcement

8. Reach out to the guest after event
   - Ask guests to share the videos with their networks
     - instructions: https://docs.google.com/document/d/1TYQGVzdcoTH9-ULzFWK-2nGt8X-50ju5kYcnJV4F83M/edit
   - For sponsored workshop, ask the sponsor about how did it go
     - instructions: https://docs.google.com/document/d/1kdrmpwrvDjYf_cNVJaLo6qhVJ2B7a5As-DrAx_mYWb8/edit

9. Emails
   - Upload the emails from Luma to Mailchimp
     - instructions: https://docs.google.com/document/d/1xyan3b3IdWdOnUZ93qbxpLY6lI9GjiUqzBRUJ1TmzeQ/edit
   - For sponsored events - share the list with emails with the sponsor
     - instructions: https://docs.google.com/document/d/1qf38niJVSAFYz0hkTXVma_bvM9EpArQLUD4wF4YB_Ok/edit
   - Add links from the speaker to the YouTube video
     - instructions: https://docs.google.com/document/d/1wj9PWXhYqWopZMzZX4POucoMECoBDCu4I8irbR88qk8/edit
   - Check if the Sponsored workshop Invoice has been paid

---

## 6. Open-Source Spotlight

- Trello name: `⚙️ [Open-Source Spotlight] - Tool - Name`
- Type: oss
- Display:
  - Emoji: ⚙️
  - Tags: Open-Source Spotlight
  - Title: Tool - Name
- Anchor date: YouTube publish date
- Trigger: manual. Created when a tool author agrees to record a demo

Pre-recorded video showcasing an open-source tool. Unlike live events, this is recorded asynchronously and then published.

Links (pre-defined for each bundle):
- Guest email
- Tool github link
- Youtube Link

Overview docs:
- [Process documents](https://docs.google.com/document/d/1FEmQV8myR3jN-8_kCG_tQh4jrrxFZJPpRag9iPf_RII/edit)
- [Events](https://docs.google.com/document/d/1SVWxBsBzvG5URX2tWD9M9HRfI11c2eq3Z7TMt0-JHqQ/edit)
- [Events (pre-recorded) - Open-Source Spotlight](https://docs.google.com/document/d/1foX7pya-Ywi153LkZWFWBw2nI6HYvcQKS-QQBEUmGZc/edit)

Phases & tasks (14 tasks across 5 checklists):

1. Reach out
   - Reach out to github authors
   - Reach out to tool author(s)
     - instructions: https://docs.google.com/document/d/1FSJQoMOAZOpiA7EGR2t-xYcu_nEEd2hQSZCC3t5vdq8/edit
   - Find time if they can't find anything in calendly

2. Video recording
   - Schedule the recording
     - instructions: https://docs.google.com/document/d/1GsM_Vlit2bB5MCRUH3AQHZWk3xI96ZZEtEvgzb_CMyY/edit
   - Record the demo

3. YouTube video editing
   - Download the video from zoom and upload to YouTube
     - instructions: https://docs.google.com/document/d/1LU0G3jlcCf19hYIp-TNfz94tDUrjEBvyPJ3_QuJQNvg/edit
   - Editing the video
     - instructions: https://docs.google.com/document/d/1hN5STE669QiqwL5oWCIEDP-jbe7W2Aa93UKSQ3iUHEU/edit
   - Add timecodes to the YouTube video
     - instructions: https://docs.google.com/document/d/1csT9bIvr8WNz3anuS-fO_WrIHvln2P3Hcsh7P0t-lOc/edit
   - Ask the authors to review the generated codes
     - instructions: https://docs.google.com/document/d/1csT9bIvr8WNz3anuS-fO_WrIHvln2P3Hcsh7P0t-lOc/edit
   - Schedule Youtube video [milestone: 0d, publish on Wed at 5PM CET]
     - instructions: https://docs.google.com/document/d/1GsM_Vlit2bB5MCRUH3AQHZWk3xI96ZZEtEvgzb_CMyY/edit
   - Tell the Author when the OSS video will be published
     - instructions: https://docs.google.com/document/d/1_jJLDGSTuyRGz6fimgwJLBGyT_dVl_rfr8T50qIqwa8/edit

4. Reach out again
   - Add to the "Open-Source Spotlight" playlist after it's published
   - Ask the guest to share the recording with their network
     - instructions: https://docs.google.com/document/d/1JJxAnhoVslGXmjc9Fw3JZrUDD6-srJQcMiHP8rPjMsw/edit

5. Social Media posts
   - Schedule for Social Media Announcement
     - instructions: https://docs.google.com/document/d/1BleKsd44Uhhj24D-D5qup0Gf3GcM6cwdAjbZD2jGGuA/edit

---

## 7. Course

- Trello name: `🎓 [Course] Course- YYYY`
- Type: course
- Display:
  - Emoji: 🎓
  - Tags: Course
  - Title: Course Name
- Anchor date: Course start date
- Trigger: manual. Created when a course cohort is planned (typically 1-2 months before start)

Free online course promotion. Focus is on marketing and community engagement rather than content creation (course content is prepared separately).

Links (pre-defined for each bundle):
- [Free courses page](https://datatalks.club/blog/guide-to-free-online-courses-at-datatalks-club.html)
- [Playbook to promote courses](https://docs.google.com/document/d/1ENqjMNPzG4gVTdQzFeDfwyReRbrw2fe2f6AFHrirVBM/edit)

Phases & tasks (8 tasks across 3 checklists):

1. Pre-course Q&A [milestone: -14d, Q&A webinar date]
   - Create an event following the standard process
     - instructions: https://docs.google.com/document/d/1ENqjMNPzG4gVTdQzFeDfwyReRbrw2fe2f6AFHrirVBM/edit
   - Valeriia - prepare the description for the event (assignee: Valeriia)

2. Social media posts
   - Announce the course start [milestone: -30d]
   - Announce the Q&A webinar when the event is ready on Luma
   - Announce the course start (educational content, carousel, resources) [milestone: -14d]
   - Feedback posts [milestone: -7d]

3. Other ideas to promote the course
   - Reach out to top LinkedIn influencers in the course topic
   - Promote the course in relevant LinkedIn, Facebook, Discord, Slack groups, HackerNews, Reddit, Quora

---

## 8. Social Media Weekly Posts

- Trello name: `📱[Social media] Weekly posts (DD MMM 2024)`
- Type: social-media
- Display:
  - Emoji: 📱
  - Tags: Social media
  - Title: Weekly posts
- Anchor date: Week start (Monday)
- Trigger: automatic, weekly. Create bundle on Friday for the following week

Weekly social media content schedule. One post per day, Monday through Friday.

Links (pre-defined for each bundle):
- Mailchimp Newsletter link
- Sponsorship document

Overview docs (referenced in description):
- [New event announcement](https://docs.google.com/document/d/12Af_uNfrZ4VhjGLRAGm-NzvzCc5dfAG1j9GAaHpZtD0/edit)
- [Overview after the podcast](https://docs.google.com/document/d/1156ty59e3ZlUW3nPpMTd_2smzW40v0ANt9nojUxZ2Gc/edit)
- [Guest recommendations from the podcast](https://docs.google.com/document/d/1XDOfmUHMjKdtlImd5C5LGalCWD8tChefCbB_dtskfWs/edit)
- [Post about all upcoming events](https://docs.google.com/document/d/1NkXUsmaL1JmfX1aO7UbMp349sRGNF6Mu5nd9Dk7Oz2Y/edit)
- [Post about OSS](https://docs.google.com/document/d/1BleKsd44Uhhj24D-D5qup0Gf3GcM6cwdAjbZD2jGGuA/edit)
- [Post about article](https://docs.google.com/document/d/1bj4WnhnRQ_C1L1KJPzUv2REQZOzma9PU8Cz6ZfcV8Fs/edit)

Tasks (5 tasks, 1 checklist):

1. Weekly posts
   - Monday [milestone: anchor]
   - Tuesday [milestone: +1d]
   - Wednesday - Sponsorship post (Twitter from sponsorship doc, LinkedIn from newsletter) [milestone: +2d]
   - Thursday [milestone: +3d]
   - Friday [milestone: +4d]

---

## 9. Tax Report

- Trello name: `Tax Report (MM/YYYY)`
- Type: tax-report
- Display:
  - Emoji: (none)
  - Tags: Tax, Finance
  - Title: Tax Report
- Anchor date: Month end date (no specific event day, tasks are sequential)
- Trigger: automatic, monthly. Create bundle on 1st of the following month (month must close before report work begins)

Monthly tax/bookkeeping report. Involves reviewing financials, cross-checking bank accounts, and preparing a report for the accountants.

Links (pre-defined for each bundle):
- [Upload link](https://tilz.quickconnect.to/sharing/UcXMIHLOH)

Overview docs:
- [Process documents](https://docs.google.com/document/d/1FEmQV8myR3jN-8_kCG_tQh4jrrxFZJPpRag9iPf_RII/edit)
- [Tax reports](https://docs.google.com/document/d/1fuWlBKFxWfupmRz9442En78xAwyXjYw_9Aspf81lhv8/edit)

Tasks (8 tasks, 1 checklist):

1. To Do's
   - Open the bookkeeping report for the specific month
   - Review and update to-dos with actual numbers from Dropbox documents, receipts, and invoices
     - instructions: https://docs.google.com/document/d/1O9TVl2Q2tTDDFaiZro0XTYXpB8i1r9Q6Ryp-dshGFbQ/edit
   - Convert any USD or other non-euro currencies to EUR using WISE
     - instructions: https://docs.google.com/document/d/1WWhBApSyw2JsvkVL6WdmYYRcd9ETf58D5SmN2JnJCXo/edit
   - Create Bank Statements from Finom and Revolut
     - instructions (Finom): https://docs.google.com/document/d/198F0Z2auEkvRGHXgD5k2zYx7Cjk2mW6sUHuGeNspsYU/edit
     - instructions (Revolut): https://docs.google.com/document/d/1gzRoauqf8UVmJogYV4VphrgADesOrBpFSkOc-8uTq4Q/edit
   - Cross-check Revolut and Finom for any missing expenses or income
     - instructions: https://docs.google.com/document/d/1Uh6ZQwQ2wBV2S7WZVnph_SauyPQQTQsym5zrrX94vHg/edit
   - Prepare a zip archive of the report and send it to accounting
     - instructions: https://docs.google.com/document/d/1__AYDWyzYiMzByGcWfdNq9wIWeCXy71Q7YHxq_LWmSs/edit
   - Notify the accountants that the report is ready
   - Organize invoices folders: Expenses and Incoming Transactions

---

## 10. Maven Lightning Lesson

- Trello name: `📺 [Maven LL] 2026-MM-DD - Topic - Speaker`
- Type: maven-ll
- Display:
  - Emoji: 📺
  - Tags: Maven, Maven Lightning Lesson
  - Title: Topic - Speaker
- Anchor date: Event date
- Trigger: manual. Created when Alexey sends Maven LL content and a date is set

Short-form educational content published on Maven platform. Events are created on Maven (not Luma/Meetup), and video editing involves cutting recordings with ffmpeg.

Links (pre-defined for each bundle):
- Guest email
- Maven link
- Youtube Link

Phases & tasks (7 tasks across 2 checklists):

1. Event creation
   - Alexey will send content for Maven LL (assignee: Alexey)
   - Create a blocker in the Calendar
   - Create Lightning Lessons on Maven
     - instructions: https://docs.google.com/document/d/1vINJ7_hVlhvRLzo9aWoIVEk6UXxpvI0IoNTzm5V4O8k/edit
   - Create a banner for the event on Canva
     - instructions: https://docs.google.com/document/d/12QPknzYsV2TCRAte5_CCPu3T3rfL7i2EnF018Sv46sw/edit

2. After the event
   - Downloading, Uploading and Editing Maven Videos for YouTube
     - instructions: https://docs.google.com/document/d/13-HQdWdx76Zb1cNFZkXIutzenpwGab2-LRjaiSbc8rw/edit
   - Cut the videos using ffmpeg
     - instructions: https://docs.google.com/document/d/1VW_M7LXOPZ09IZQ70qALfHNxIJYpI3oalNMDygj37NI/edit
   - Send the Youtube link and cut videos to DTC Content team in Telegram

---

## 11. Office Hours

- Trello name: `📺 [Office Hours] 2026-MM-DD - Topic - Alexey Grigorev`
- Type: office-hours
- Display:
  - Emoji: 📺
  - Tags: Office Hours
  - Title: Topic - Alexey Grigorev
- Anchor date: Event date
- Trigger: manual. Created when Alexey sends Grace the Zoom recording link after the event

Regular office hours hosted by Alexey. Post-event work involves video processing, summarization, and Maven announcements.

Links (pre-defined for each bundle):
- Youtube Link
- Summary Document

Phases & tasks (5 tasks across 1 checklist):

1. After the event
   - Alexey will send a Zoom video link for Office Hours (assignee: Alexey)
   - Downloading and Uploading Office Hours Videos for YouTube
     - instructions: https://docs.google.com/document/d/1pWWERBr2fQDtU7APUpq78qd_cM4gqIuHarEBVkttF70/edit
   - Summarizing Video Transcripts For Office Hours
     - instructions: https://docs.google.com/document/d/1QaWt5ePTu9yifyt84-fgGVYProNT28RTVb-PG3a-y1o/edit
   - Generating Office Hours Video Description and Timecodes for YouTube
     - instructions: https://docs.google.com/document/d/13-HQdWdx76Zb1cNFZkXIutzenpwGab2-LRjaiSbc8rw/edit
   - Making announcements in Maven
     - instructions: https://docs.google.com/document/d/1Se-vZc4iwfLrIskR6L4xaY2fxKE8l_FJ6TFpyDVOVTo/edit

---

## Summary

| # | Template | Type | Tags | Tasks | Phases | Anchor date |
|---|----------|------|------|-------|--------|-------------|
| 1 | Newsletter | newsletter | Newsletter | 15 | 5 | Weekly (publish day) |
| 2 | Book of the Week | book-of-the-week | Book of the Week | 20 | 7 | Event week (Mon-Fri) |
| 3 | Podcast | podcast | Podcast | 40 | 10 | Stream date |
| 4 | Webinar | webinar | Webinar | 28 | 9 | Stream date |
| 5 | Workshop | workshop | Workshop | 30 | 9 | Stream date |
| 6 | Open-Source Spotlight | oss | Open-Source Spotlight | 14 | 5 | Publish date |
| 7 | Course | course | - | 8 | 3 | Course start date |
| 8 | Social Media Weekly | social-media | Social media | 5 | 1 | Week start (Mon) |
| 9 | Tax Report | tax-report | - | 8 | 1 | Month end |
| 10 | Maven LL | maven-ll | Maven Lightning Lesson | 7 | 2 | Event date |
| 11 | Office Hours | office-hours | Office Hours | 5 | 1 | Event date |

Observations:
- Live event templates (Podcast, Webinar, Workshop) share a common pattern: reach out -> event creation -> announce -> remind -> stream -> video editing -> post-event. These could potentially share common task definitions.
- "Actual stream" is a natural milestone task in all live event templates - fixed to the anchor date.
- Webinar and Workshop are nearly identical - workshop adds a workshop document and sponsored invoice handling.
- Assignee patterns: Valeriia handles newsletter content blocks, social media announcements. Alexey handles podcast uploads, Maven content. Most other tasks are unassigned (available to anyone).
