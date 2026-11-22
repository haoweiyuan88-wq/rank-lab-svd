# Rank Lab · SVD Image Lab

Upload a photo and change the number of singular values kept in its reconstruction. The original, the reconstructed image and the equation can be explored together.

**[Open the experiment](https://haoweiyuan88-wq.github.io/rank-lab-svd/)** · [Classroom QR code](assets/class-qr.png)

## Try it in class

Select an example or choose **Upload an image**. Press **+** to see one rank-one term added, then compare 5 with 20 to add a whole group. The change map highlights brighter and darker regions. Tap a pixel in the original to see its previous value, the signed change and its new value. In color mode, choose red, green or blue in the equation. **Enlarge view** is designed for projection.

Photos are processed on each student’s device. **Share** displays the QR code for the current URL.

## Local use

Unzip `Rank-Lab-Classroom.zip` and double-click `Start-Class.command` on a Mac to host the experiment on classroom Wi-Fi. See the included instructions for Windows, other platforms or individual offline use.

For development, run `python3 -m http.server 8000` at the repository root and open `http://localhost:8000/`. GitHub Pages serves the root of the `gh-pages` branch.

## Source

- `index.html`, `style.css` and `app.js` provide the interface.
- `svd-worker.js` computes the decomposition, rank reconstructions, change maps and pixel contributions.
- `sharing.js` and `assets/qr-code.js` generate QR codes locally. The QR component includes its license in its source.
- Photo credits and licenses are available in **Image credits** in the experiment.
- `classroom/` contains the local server and packager. Run `python3 classroom/package.py` to rebuild the classroom ZIP.
