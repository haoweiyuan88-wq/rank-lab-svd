Rank Lab · Classroom Wi-Fi edition

Start a class on a Mac

1. Unzip the entire pack. Connect the presenting computer and phones to the same Wi-Fi or hotspot with device-to-device access.
2. Double-click Start-Class.command on the computer. The launcher uses Python 3.7 or later and its standard library.
3. The presenting browser opens a QR code. Students can scan it with their phone cameras. You can also paste the “Class link” printed in Terminal into a class chat.
4. Close the QR dialog to demonstrate. Students can choose their own pictures, change k, see the equation and save their reconstruction. Keep the computer and launcher running during class. Press Control+C to stop.

Other ways to open the experiment

• Open index.html directly for individual offline use.
• On Mac or Linux, run python3 classroom.py from the unzipped folder. On Windows, use py -3 classroom.py. If a browser does not open, paste the “Project the QR code” address from the terminal into the presenting browser.
• If macOS does not open the launcher, open Terminal, type python3 followed by a space, drag classroom.py into Terminal and press Enter.
• If your computer asks for local network access, follow your school’s device and network rules. The server provides the experiment. Selected photos are processed on each student’s device.

If a phone cannot reach the classroom server

• Check the address under the projected QR code against the printed class link. Restart the launcher after switching Wi-Fi.
• Some campus Wi-Fi networks isolate devices. Use a network or hotspot that lets the phones reach the presenting computer, or share index.html for individual computer use.
• On a computer with multiple network adapters, use python3 classroom.py --address followed by its Wi-Fi IPv4 address. On a Mac, find it in System Settings → Wi-Fi → Details → TCP/IP.

Static hosting

The standalone index.html includes the example photos, SVD code and QR generator. It can also be served from a static host. The Share dialog uses the HTTP or HTTPS address at which the page is open.
