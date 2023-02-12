import Puppeteer from "puppeteer";
import Cheerio from "cheerio";
import Downloader from "nodejs-file-downloader";
import { v4 as Uuid } from "uuid";
import {
	blue,
	cyan,
	bgMagenta,
	magenta,
	yellow,
	green,
	bgRedBright,
	redBright,
	magentaBright,
	cyanBright,
	greenBright,
	bgRed,
} from "chalk";

process.setMaxListeners(0);
(async () => {
	

	console.log(cyan("[ Puppeteer ] Launching the browser..."));
	const browser = await Puppeteer.launch(),
		newPage = await browser.newPage();
	
	const getCoursesInABranch = async (npage, link) => {
		console.log(cyan("[ Puppeteer ] Extracting courses and exercises"));
		console.log("-->", link);
		await npage.setDefaultNavigationTimeout(0);
		await npage.goto(link);

		console.log(cyan("[ Puppeteer ] Evaluating the dom tree"));
		const pageHTML = await npage.evaluate(() => {
			return {
				html: document.documentElement.innerHTML,
			};
		});

		console.log(cyan("[ Cheerio ] Loading a Cheerio instance..."));
		const $ = Cheerio.load(pageHTML.html);

		console.log("--> Extracting courses");
		return $(".ul-timeline > li")
			.map((Index, Item) => {
				return {
					title: $(Item).find("h2").text().trim(),
					nodes: $(Item)
						.find(".t-b ul li")
						.map((Index, Item) => {
							if (
								$(Item).find("a > span").attr("class").includes("mdi-file-pdf")
							) {
								return $(Item).find("a").attr("href");
							}
						}),
				};
			})
			.get();
	};

	let documents = [];

	const getDataInsideACourse = async (nodes, one, nextone, courseIndex) => {
		console.log(cyanBright(`==> ==> [ getDataInsideACourse ] Crawling`, one));
		console.log(cyanBright("==> ==> [ Puppeteer ] Launching the browser..."));
		const browser = await Puppeteer.launch(),
		newPage = await browser.newPage(),
		folderNode = Uuid();

		await newPage.setDefaultNavigationTimeout(0);
		await newPage.goto(one);

		console.log(cyanBright("==> ==> [ Puppeteer ] Evaluating the dom tree"));
		const nodeHTML = await newPage.evaluate(() => {
			return {
				html: document.documentElement.innerHTML,
			};
		});

		console.log(
			cyanBright("==> ==> [ Cheerio ] Loading a Cheerio instance...")
		);
		const _ = await Cheerio.load(nodeHTML.html);

		console.log("==> ==> ==> Extracting title, pdf, images...");
		const document = {
			title: _("#top > main > div.page-title.swap > div > h1").text().trim(),
			pdf: _(
				"#top > main > div:nth-child(4) > div > div.pdf-tag-hide.col-sm-12 > p > a"
			).attr("href"),
			images: _(".document-viewer figure a")
				.map((Index, Image) => _(Image).attr("href"))
				.get(),
		};

		const pdfDownloader = new Downloader({
			url: document.pdf,
			directory: `./main/downloads/${courseIndex}/${folderNode}-${document.title}`,
			fileName: "main.pdf",
		});

		try {
			console.log(cyanBright("==> ==> [ Downloading ] PDF", document.pdf));
			await pdfDownloader.download();
		} catch (error) {
			console.log(bgRed("==> ==> [ ERROR ] PDF failed", document.pdf, error));
			await pdfDownloader.download();
		}

		const downloadingImages = async (images, one, nextone) => {
			const imageDownloader = new Downloader({
				url: one,
				directory: `./main/downloads/${courseIndex}/${folderNode}-${document.title}/images`,
				fileName: `bactood-${images.indexOf(one)}.jpg`,
			});

			try {
				console.log(cyanBright("==> ==> [ Downloading ] Image", one));
				await imageDownloader.download();
			} catch (error) {
				console.log(bgRed("==> ==> [ ERROR ] Image failed", one, error));
				await imageDownloader.download();
			}

			if (images.indexOf(one) !== images.length - 1) {
				await downloadingImages(
					images,
					nextone,
					images[images.indexOf(nextone) + 1]
				);
			} else console.log(cyan(`==> ==> Link is crawled, moving to next link!`));
		};

		await downloadingImages(
			document.images,
			document.images[0],
			document.images[1] ? document.images[1] : false
		);
		
		console.log(
			yellow(
				`==> ==> [ getDataInsideACourse ] Taking a break before moving to the next link!`
			)
		);
		setTimeout(async () => {
			if (nodes.indexOf(one) !== nodes.length - 1) {
				await getDataInsideACourse(
					nodes,
					nextone,
					nodes[nodes.indexOf(nextone) + 1],
					courseIndex
				);
			} else console.log(cyan(`==> ==> Link is crawled, moving to next link!`));
			await browser.close();
		}, 10000);
	};

	const crawlEachCourse = async (list, one, nextone) => {
		const courseNumber = list.indexOf(one) + 1;


		console.log(
			cyan("[ getDataInsideACourse ] Crawling course N00" + courseNumber)
		);
		await getDataInsideACourse(
			one.nodes.get(),
			one.nodes[0],
			one.nodes[1],
			courseNumber
		);

		if (list.indexOf(one) !== list.length - 1) {
			crawlEachCourse(list, nextone, list[list.indexOf(nextone) + 1]);
		} else console.log(green(`Crawling is done.`));
	};

	let list = await getCoursesInABranch(
		newPage,
		"https://www.alloschool.com/course/alriadhiat-althania-bak-alom-riadhia-awa"
	);

	await crawlEachCourse(list, list[0], list[1]);

	await browser.close();
})();
