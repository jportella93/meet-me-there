const bkg = chrome.extension.getBackgroundPage();

const form = document.querySelector('#origin-date-form')
const submitBtn = document.querySelector('#origin-date-form-submit')

const formParsedContent = {}

// Add origins
let originCounter = 2;

const addOriginBtn = document.querySelector('#add-origin')

addOriginBtn.onclick = () => {
  originCounter++
  const node = document.createElement('input')
  node.id = `origin${originCounter}`
  node.name = `origin${originCounter}`
  node.placeholder = `origin ${originCounter}`
  form.appendChild(node)
}

// Submit
submitBtn.onclick = async () => {

  // Commented out for developing
  // Get form content
  // const inputs = Array.from(document.querySelectorAll('input'))
  // for (let input of inputs) {
  //   if (input.type !== 'submit') {
  //     formParsedContent[input.name] = {
  //       name: input.name,
  //       type: input.type,
  //       value: input.value}
  //   }
  // }

  // This only for developing
  const formParsedContent = {
    "leaveDate": {
      "name": "leaveDate",
      "type": "date",
      "value": "2019-03-27"
    },
    "returnDate": {
      "name": "returnDate",
      "type": "date",
      "value": "2019-03-30"
    },
    "origin1": {
      "name": "origin1",
      "type": "text",
      "value": "BCN"
    },
    "origin2": {
      "name": "origin2",
      "type": "text",
      "value": "GVA"
    }
  }

  const leaveDate = formParsedContent['leaveDate'].value;
  const returnDate = formParsedContent['returnDate'] ? formParsedContent['returnDate'].value : null;

  delete formParsedContent['leaveDate']
  delete formParsedContent['returnDate']

  const origins = []
  Object.keys(formParsedContent).forEach(key => formParsedContent[key].name.includes('origin') ?
  origins.push({
    Id: formParsedContent[key].value
  }) : null)

  // bkg.console.log(origins)

  // Get Prices of destination countries for each origin
  function getPricesFrom(origins, destination = 'anywhere') {
    return new Promise(async (resolve, reject) => {
      const countriesWithPrice = {}
      try {
        await Promise.all(origins.map(origin => new Promise(async (resolve, reject) => {
            try {
            bkg.console.log('origin.Id', origin.Id)

            const URL = `https://www.skyscanner.net/g/browseservice/dataservices/browse/v3/bvweb/ES/EUR/es-ES/destinations/${origin.Id}/${destination}/${leaveDate}${returnDate ? '/' + returnDate + '/' : ''}?profile=minimalcityrollupwithnamesv2&include=image&apikey=8aa374f4e28e4664bf268f850f767535`

            // bkg.console.log(URL)

            let res = await fetch(URL, {
                "credentials": "include",
                "headers": {
                  "accept": "application/json, text/javascript, */*; q=0.01",
                  "accept-language": "en-ES,es;q=0.9,ca-ES;q=0.8,ca;q=0.7,en;q=0.6,de;q=0.5,fr;q=0.4",
                  "x-requested-with": "XMLHttpRequest"
                },
                "referrer": "https://www.skyscanner.es/transporte/vuelos-desde/bcn/190201/190203/?adults=1&children=0&adultsv2=1&childrenv2=&infants=0&cabinclass=economy&rtn=1&preferdirects=false&outboundaltsenabled=false&inboundaltsenabled=false&ref=home",
                "referrerPolicy": "no-referrer-when-downgrade",
                "body": null,
                "method": "GET",
                "mode": "cors"
              })
            res = await res.json()

            // Get lowest Price and filter place without Prices
            const flagPrice = 999999; // Fix this hack
            const places = res.PlacePrices.map(el => {
              return { ...el,
                Price: Math.min(el.DirectPrice || flagPrice, el.IndirectPrice || flagPrice) // Fix this hack
              }
            }).filter(el => el.Price !== flagPrice).sort((a, b) => a.Price - b.Price)

            // bkg.console.log(places)


            countriesWithPrice[origin.value] = places
            // bkg.console.log(countriesWithPrice)
            // bkg.console.log('going to resolve')
            resolve()
            } catch (error) {
              reject(error)
            }
          }))
        )

      // bkg.console.log(countriesWithPrice)
      resolve(countriesWithPrice)
      } catch (error) {
      // bkg.console.log('here2!!')
        reject(error)
      }
    })
  }

  // bkg.console.log('here!!')
  let countriesWithPrice;
  try {
    countriesWithPrice = await getPricesFrom(origins)
    // bkg.console.log('here 2')
  } catch (error) {
    // bkg.console.log('here 4')
    bkg.console.error(error)
  }

  // bkg.console.log('countries result',countriesWithPrice)

  const commonCountries = {};
  Object.keys(countriesWithPrice).forEach(origin => countriesWithPrice[origin].forEach(country => {
    if (Object.values(countriesWithPrice).every(list => list.find(el => el.Name === country.Name))) {
      // bkg.console.log('country.Name', country.Name)
      const countryToSet = commonCountries[country.Name]
      // bkg.console.log('country to set', countryToSet)
      if (countryToSet) countryToSet.Price += country.Price
      else commonCountries[country.Name] = {...country}
    }
  }))

  // bkg.console.log('commonCountries', commonCountries)

  const commonCheapestCountries = [];
  Object.values(commonCountries).forEach(country => {
    // bkg.console.log('country', country)
    const alreadySetCountry = commonCheapestCountries.find(el => el.Name === country.Name)
    if (!alreadySetCountry) {
      commonCheapestCountries.push({...country})
    } else {
      alreadySetCountry.Price += country.Price
    }
  })
  commonCheapestCountries.sort((a,b) => a.Price - b.Price)

  bkg.console.log('commonCheapestCountries', commonCheapestCountries)

  // Get destination airports
  let destinationAirports;
  try {
    destinationAirports = await Promise.all(commonCheapestCountries.map(country => getPricesFrom(origins, country.Id)))
    // bkg.console.log('here 2')
  } catch (error) {
    // bkg.console.log('here 4')
    bkg.console.error(error)
  }

  bkg.console.log('destinationAirports', destinationAirports)




    // Append formParsedContent to the DOM
    // const resultList = document.querySelector('#result-list')

    // for (let key in formParsedContent) {
    //   if (formParsedContent.hasOwnProperty(key)) {
    //     const node = document.createElement('li')
    //     const t = document.createTextNode(formParsedContent[key]);
    //     node.appendChild(t)
    //     resultList.appendChild(node)
    //     bkg.console.log(node)
    //   }
    // }
}
