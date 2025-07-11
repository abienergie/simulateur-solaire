import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { formatCurrency } from './formatters';
import { getOrientationLabel } from './orientationMapping';
import { getSunshineHours } from './sunshineData';

// Fonction pour formater les nombres avec séparateur de milliers
function formatNumber(num: number): string {
  return num.toLocaleString('fr-FR');
}

// Fonction pour obtenir le label d'un masque solaire
function getShadingLabel(value: number): string {
  if (value === 0) return 'Aucun';
  if (value <= 5) return 'Léger';
  if (value <= 10) return 'Modéré';
  if (value <= 15) return 'Important';
  return 'Très important';
}

export async function generatePDF(
  params: any,
  projection: any,
  productionAnnuelle: number,
  clientInfo: {
    civilite: string;
    nom: string;
    prenom: string;
    adresse: string;
    codePostal: string;
    ville: string;
    telephone: string;
    email: string;
    pdl?: string;
  },
  installationParams: {
    typeCompteur: string;
    consommationAnnuelle: number;
    puissanceCrete: number;
    nombreModules: number;
    inclinaison: number;
    orientation: number;
    pertes: number;
    masqueSolaire: number;
    microOnduleurs: boolean;
    bifacial: boolean;
    surfaceTotale: number;
  }
): Promise<void> {
  // Création du document PDF
  const doc = new jsPDF();
  
  // Récupérer les codes promo appliqués depuis le localStorage
  const appliedPromoCodes = localStorage.getItem('applied_promo_codes');
  const promoDiscount = parseFloat(localStorage.getItem('promo_discount') || '0');
  const freeMonths = parseInt(localStorage.getItem('promo_free_months') || '0', 10);
  const freeDeposit = localStorage.getItem('promo_free_deposit') === 'true';
  const freeBatterySetup = localStorage.getItem('promo_free_battery_setup') === 'true';
  const freeSmartBatterySetup = localStorage.getItem('promo_free_smart_battery_setup') === 'true';
  const freeEcojoko = localStorage.getItem('freeEcojoko') === 'true';
  
  // Récupérer les informations sur les batteries
  const batterySelection = localStorage.getItem('batterySelection');
  let batteryInfo = null;
  if (batterySelection) {
    try {
      batteryInfo = JSON.parse(batterySelection);
    } catch (e) {
      console.error('Erreur lors du parsing des informations de batterie:', e);
    }
  }
  
  // Récupérer les informations sur les technologies installées
  const inverterType = localStorage.getItem('inverterType') || 'central';
  const mountingSystem = localStorage.getItem('mountingSystem') || 'surimposition';
  const bifacial = localStorage.getItem('bifacial') === 'true';
  
  // Récupérer l'option Ecojoko
  const includeEcojoko = localStorage.getItem('includeEcojoko') === 'true';
  
  // Récupérer l'image satellite si disponible
  const satelliteImageUrl = localStorage.getItem('satellite_image_url');
  
  // Ajouter un logo
  const logoImg = new Image();
  logoImg.src = 'https://i.postimg.cc/7Z49VZpw/ABI-e-nergie-Blanc.png';
  
  await new Promise((resolve) => {
    logoImg.onload = resolve;
    logoImg.onerror = resolve; // Continue même si le logo ne charge pas
  });
  
  try {
    doc.addImage(logoImg, 'PNG', 10, 10, 50, 25);
  } catch (e) {
    console.warn('Impossible de charger le logo:', e);
  }
  
  // Ajouter un titre
  doc.setFontSize(22);
  doc.setTextColor(40, 40, 40);
  doc.text('Rapport de simulation solaire', 105, 20, { align: 'center' });
  
  doc.setFontSize(12);
  doc.setTextColor(100, 100, 100);
  doc.text(`Généré le ${new Date().toLocaleDateString('fr-FR')}`, 105, 30, { align: 'center' });
  
  // Informations client
  doc.setFontSize(16);
  doc.setTextColor(40, 40, 40);
  doc.text('Informations client', 14, 50);
  
  doc.setFontSize(11);
  doc.setTextColor(60, 60, 60);
  
  const clientData = [
    ['Nom', `${clientInfo.civilite} ${clientInfo.nom} ${clientInfo.prenom}`],
    ['Adresse', `${clientInfo.adresse}, ${clientInfo.codePostal} ${clientInfo.ville}`],
    ['Téléphone', clientInfo.telephone],
    ['Email', clientInfo.email]
  ];
  
  if (clientInfo.pdl) {
    clientData.push(['Point de livraison (PDL)', clientInfo.pdl]);
  }
  
  autoTable(doc, {
    startY: 55,
    head: [],
    body: clientData,
    theme: 'plain',
    styles: {
      fontSize: 10,
      cellPadding: 3
    },
    columnStyles: {
      0: { fontStyle: 'bold', cellWidth: 50 },
      1: { cellWidth: 'auto' }
    }
  });
  
  // Caractéristiques de l'installation
  const finalY = (doc as any).lastAutoTable.finalY;
  doc.setFontSize(16);
  doc.setTextColor(40, 40, 40);
  doc.text('Caractéristiques de l\'installation', 14, finalY + 15);
  
  const departement = clientInfo.codePostal.substring(0, 2);
  const ensoleillement = getSunshineHours(departement);
  
  const installationData = [
    ['Puissance crête', `${installationParams.puissanceCrete.toFixed(1)} kWc`],
    ['Nombre de modules', `${installationParams.nombreModules} modules`],
    ['Surface totale', `${installationParams.surfaceTotale.toFixed(1)} m²`],
    ['Type de compteur', installationParams.typeCompteur === 'monophase' ? 'Monophasé' : 'Triphasé'],
    ['Consommation annuelle', `${formatNumber(installationParams.consommationAnnuelle)} kWh/an`],
    ['Orientation', `${getOrientationLabel(installationParams.orientation)}`],
    ['Inclinaison', `${installationParams.inclinaison}°`],
    ['Masque solaire', getShadingLabel(installationParams.masqueSolaire)],
    ['Ensoleillement local', `${formatNumber(ensoleillement)} kWh/m²/an`]
  ];
  
  // Ajouter les technologies spécifiques
  if (inverterType !== 'central') {
    installationData.push([
      'Type d\'onduleur', 
      inverterType === 'solenso' ? 'Micro-onduleurs Solenso' : 'Micro-onduleurs Enphase'
    ]);
  }
  
  if (bifacial) {
    installationData.push(['Type de panneaux', 'Modules bifaciaux']);
  }
  
  if (mountingSystem !== 'surimposition') {
    installationData.push([
      'Système de fixation', 
      mountingSystem === 'bac-lestes' ? 'Bac lestés' : 'Intégration au bâti (IAB)'
    ]);
  }
  
  // Ajouter les informations de batterie si présentes
  if (batteryInfo && batteryInfo.type) {
    switch (batteryInfo.type) {
      case 'physical':
        if (batteryInfo.model) {
          installationData.push(['Batterie', `${batteryInfo.model.model} (${batteryInfo.model.capacity} kWh)`]);
        } else {
          installationData.push(['Batterie', 'Batterie physique']);
        }
        break;
      case 'virtual':
        installationData.push(['Stockage virtuel', 'Smart Battery']);
        if (batteryInfo.virtualCapacity) {
          installationData.push(['Capacité de pilotage', `${batteryInfo.virtualCapacity} kW`]);
        }
        if (batteryInfo.includeSmartCharger) {
          installationData.push(['Smart Charger', 'Inclus']);
        }
        break;
      case 'mybattery':
        installationData.push(['Stockage virtuel', 'MyBattery']);
        break;
    }
  }
  
  // Ajouter l'option Ecojoko si sélectionnée
  if (includeEcojoko) {
    installationData.push(['Assistant connecté', 'Ecojoko']);
  }
  
  autoTable(doc, {
    startY: finalY + 20,
    head: [],
    body: installationData,
    theme: 'plain',
    styles: {
      fontSize: 10,
      cellPadding: 3
    },
    columnStyles: {
      0: { fontStyle: 'bold', cellWidth: 70 },
      1: { cellWidth: 'auto' }
    }
  });
  
  // Résultats de production
  const finalY2 = (doc as any).lastAutoTable.finalY;
  doc.setFontSize(16);
  doc.setTextColor(40, 40, 40);
  doc.text('Résultats de production', 14, finalY2 + 15);
  
  const productionData = [
    ['Production annuelle', `${formatNumber(productionAnnuelle)} kWh/an`],
    ['Taux d\'autoconsommation', `${params.autoconsommation}%`],
    ['Énergie autoconsommée', `${formatNumber(Math.round(productionAnnuelle * params.autoconsommation / 100))} kWh/an`],
    ['Surplus revendu', `${formatNumber(Math.round(productionAnnuelle * (1 - params.autoconsommation / 100)))} kWh/an`]
  ];
  
  autoTable(doc, {
    startY: finalY2 + 20,
    head: [],
    body: productionData,
    theme: 'plain',
    styles: {
      fontSize: 10,
      cellPadding: 3
    },
    columnStyles: {
      0: { fontStyle: 'bold', cellWidth: 70 },
      1: { cellWidth: 'auto' }
    }
  });
  
  // Résultats financiers
  const finalY3 = (doc as any).lastAutoTable.finalY;
  doc.setFontSize(16);
  doc.setTextColor(40, 40, 40);
  doc.text('Résultats financiers', 14, finalY3 + 15);
  
  // Ajouter une nouvelle page si nécessaire
  if (finalY3 + 100 > doc.internal.pageSize.height) {
    doc.addPage();
  }
  
  // Tableau des résultats financiers
  const financialData = [];
  
  if (params.financingMode === 'cash') {
    // Mode paiement comptant
    financialData.push(['Prix de l\'installation', formatCurrency(projection.prixInstallation)]);
    
    // Ajouter le prix des options
    if (inverterType === 'enphase') {
      const enphasePrice = installationParams.puissanceCrete <= 3 ? 1500 :
                          installationParams.puissanceCrete <= 6 ? 1800 : 2200;
      financialData.push(['Option micro-onduleurs Enphase', formatCurrency(enphasePrice)]);
    }
    
    // Ajouter le prix du système de fixation
    if (mountingSystem !== 'surimposition') {
      const mountingSystemCost = mountingSystem === 'bac-lestes' 
        ? 60 * installationParams.nombreModules 
        : 100 * installationParams.nombreModules;
      financialData.push([
        mountingSystem === 'bac-lestes' ? 'Système bac lestés' : 'Intégration au bâti',
        formatCurrency(mountingSystemCost)
      ]);
    }
    
    // Ajouter le prix de la batterie si présente
    if (batteryInfo) {
      if (batteryInfo.type === 'physical' && batteryInfo.model) {
        financialData.push(['Batterie physique', formatCurrency(batteryInfo.model.oneTimePrice || 0)]);
      } else if (batteryInfo.type === 'virtual') {
        // Vérifier si le code promo SMARTFREE est appliqué
        if (freeSmartBatterySetup) {
          financialData.push(['Frais de mise en service SmartBattery', `${formatCurrency(0)} (offert)`]);
        } else {
          financialData.push(['Frais de mise en service SmartBattery', formatCurrency(2000)]);
        }
        
        if (batteryInfo.includeSmartCharger) {
          financialData.push(['Smart Charger', formatCurrency(1500)]);
        }
      } else if (batteryInfo.type === 'mybattery') {
        // Vérifier si le code promo BATTERYFREE est appliqué
        if (freeBatterySetup) {
          financialData.push(['Frais d\'activation MyBattery', `${formatCurrency(0)} (offert)`]);
        } else {
          financialData.push(['Frais d\'activation MyBattery', formatCurrency(179)]);
        }
      }
    }
    
    // Ajouter l'option Ecojoko si sélectionnée
    if (includeEcojoko) {
      if (freeEcojoko) {
        financialData.push(['Option Ecojoko', `${formatCurrency(0)} (offert)`]);
      } else {
        financialData.push(['Option Ecojoko', formatCurrency(229)]);
      }
    }
    
    // Ajouter la prime à l'autoconsommation
    if (params.primeAutoconsommation > 0 && params.connectionType !== 'total_sale') {
      financialData.push(['Prime à l\'autoconsommation', `- ${formatCurrency(params.primeAutoconsommation)}`]);
    }
    
    // Ajouter la remise commerciale
    if (params.remiseCommerciale > 0) {
      financialData.push(['Remise commerciale', `- ${formatCurrency(params.remiseCommerciale)}`]);
    }
    
    // Ajouter les remises des codes promo
    if (promoDiscount > 0) {
      financialData.push(['Remise code promo', `- ${formatCurrency(promoDiscount)}`]);
      
      // Ajouter les codes promo appliqués
      if (appliedPromoCodes) {
        try {
          const codes = JSON.parse(appliedPromoCodes);
          if (codes.length > 0) {
            financialData.push(['Codes promo appliqués', codes.join(', ')]);
          }
        } catch (e) {
          console.error('Erreur lors du parsing des codes promo:', e);
        }
      }
    }
    
    // Calculer le prix final
    const totalPrice = projection.prixFinal - promoDiscount;
    
    financialData.push(['Prix final', formatCurrency(totalPrice)]);
    
    // Ajouter les économies annuelles
    const firstYearSavings = projection.projectionAnnuelle[0].economiesAutoconsommation + 
                            projection.projectionAnnuelle[0].revenusRevente;
    financialData.push(['Économies annuelles (1ère année)', formatCurrency(firstYearSavings)]);
    
    // Ajouter le temps de retour sur investissement
    financialData.push(['Temps de retour sur investissement', `${projection.anneeRentabilite} ans`]);
    
    // Ajouter les gains sur 25 ans
    const gains25ans = projection.projectionAnnuelle.slice(0, 25).reduce(
      (sum: number, year: any) => sum + year.gainTotal, 0
    );
    financialData.push(['Gains cumulés sur 25 ans', formatCurrency(gains25ans)]);
  } else {
    // Mode abonnement
    financialData.push(['Abonnement mensuel', `${formatCurrency(params.dureeAbonnement ? projection.projectionAnnuelle[0].coutAbonnement / 12 : 0)}`]);
    financialData.push(['Durée d\'engagement', `${params.dureeAbonnement} ans`]);
    
    // Vérifier si le code promo pour les mois gratuits est appliqué
    if (freeMonths > 0) {
      financialData.push([`Mois offerts`, `${freeMonths} mois`]);
    }
    
    // Vérifier si le code promo pour la caution est appliqué
    const monthlyPayment = params.dureeAbonnement ? projection.projectionAnnuelle[0].coutAbonnement / 12 : 0;
    const deposit = freeDeposit ? 0 : monthlyPayment * 2;
    
    if (freeDeposit) {
      financialData.push(['Dépôt de garantie', `${formatCurrency(0)} (offert)`]);
    } else {
      financialData.push(['Dépôt de garantie', formatCurrency(deposit)]);
    }
    
    // Ajouter les frais de mise en service si batterie
    if (batteryInfo) {
      if (batteryInfo.type === 'virtual') {
        // Vérifier si le code promo SMARTFREE est appliqué
        if (freeSmartBatterySetup) {
          financialData.push(['Frais de mise en service SmartBattery', `${formatCurrency(0)} (offert)`]);
        } else {
          financialData.push(['Frais de mise en service SmartBattery', formatCurrency(2000)]);
        }
        
        if (batteryInfo.includeSmartCharger) {
          financialData.push(['Smart Charger', formatCurrency(1500)]);
        }
      } else if (batteryInfo.type === 'mybattery') {
        // Vérifier si le code promo BATTERYFREE est appliqué
        if (freeBatterySetup) {
          financialData.push(['Frais d\'activation MyBattery', `${formatCurrency(0)} (offert)`]);
        } else {
          financialData.push(['Frais d\'activation MyBattery', formatCurrency(179)]);
        }
      }
    }
    
    // Ajouter l'option Ecojoko si sélectionnée
    if (includeEcojoko) {
      if (freeEcojoko) {
        financialData.push(['Option Ecojoko', `${formatCurrency(0)} (offert)`]);
      } else {
        financialData.push(['Option Ecojoko', formatCurrency(229)]);
      }
    }
    
    // Ajouter les codes promo appliqués
    if (appliedPromoCodes) {
      try {
        const codes = JSON.parse(appliedPromoCodes);
        if (codes.length > 0) {
          financialData.push(['Codes promo appliqués', codes.join(', ')]);
        }
      } catch (e) {
        console.error('Erreur lors du parsing des codes promo:', e);
      }
    }
    
    // Ajouter les économies annuelles
    const firstYearSavings = projection.projectionAnnuelle[0].economiesAutoconsommation + 
                            projection.projectionAnnuelle[0].revenusRevente;
    financialData.push(['Économies annuelles (1ère année)', formatCurrency(firstYearSavings)]);
    
    // Ajouter les gains sur la durée de l'abonnement
    const gainsDureeAbonnement = projection.projectionAnnuelle.slice(0, params.dureeAbonnement || 20).reduce(
      (sum: number, year: any) => sum + year.gainTotal, 0
    );
    financialData.push([`Gains cumulés sur ${params.dureeAbonnement || 20} ans`, formatCurrency(gainsDureeAbonnement)]);
    
    // Ajouter les gains sur 25 ans
    const gains25ans = projection.projectionAnnuelle.slice(0, 25).reduce(
      (sum: number, year: any) => sum + year.gainTotal, 0
    );
    financialData.push(['Gains cumulés sur 25 ans', formatCurrency(gains25ans)]);
  }
  
  autoTable(doc, {
    startY: finalY3 + 20,
    head: [],
    body: financialData,
    theme: 'plain',
    styles: {
      fontSize: 10,
      cellPadding: 3
    },
    columnStyles: {
      0: { fontStyle: 'bold', cellWidth: 100 },
      1: { cellWidth: 'auto', halign: 'right' }
    }
  });
  
  // Ajouter le code promo sous le tableau en mode cash
  if (params.financingMode === 'cash' && promoDiscount > 0 && appliedPromoCodes) {
    try {
      const codes = JSON.parse(appliedPromoCodes);
      if (codes.length > 0) {
        const promoCode = codes.join(', ');
        const y = (doc as any).lastAutoTable.finalY + 10;
        
        // Texte du code promo en gras
        doc.setFont(undefined, 'bold');
        doc.text(`Code promo : ${promoCode}`, 14, y);
        
        // Montant en rouge, aligné à droite
        doc.setTextColor(200, 0, 0);
        doc.text(
          formatCurrency(-promoDiscount),
          doc.internal.pageSize.width - 14,
          y,
          { align: 'right' }
        );
        
        // Réinitialiser les styles
        doc.setTextColor(0, 0, 0);
        doc.setFont(undefined, 'normal');
      }
    } catch (e) {
      console.error('Erreur lors du parsing des codes promo:', e);
    }
  }
  
  // Ajouter une image satellite si disponible
  if (satelliteImageUrl) {
    try {
      const finalY4 = (doc as any).lastAutoTable.finalY;
      
      // Ajouter une nouvelle page si nécessaire
      if (finalY4 + 150 > doc.internal.pageSize.height) {
        doc.addPage();
      } else {
        doc.text('Vue satellite', 14, finalY4 + 15);
      }
      
      const img = new Image();
      img.src = satelliteImageUrl;
      
      await new Promise((resolve) => {
        img.onload = resolve;
        img.onerror = resolve; // Continue même si l'image ne charge pas
      });
      
      try {
        const finalY4 = (doc as any).lastAutoTable.finalY;
        doc.addImage(img, 'PNG', 14, finalY4 + 20, 180, 120);
      } catch (e) {
        console.warn('Impossible de charger l\'image satellite:', e);
      }
    } catch (e) {
      console.warn('Erreur lors du chargement de l\'image satellite:', e);
    }
  }
  
  // Ajouter une page pour la projection financière
  doc.addPage();
  
  // Titre de la page
  doc.setFontSize(16);
  doc.setTextColor(40, 40, 40);
  doc.text('Projection financière sur 20 ans', 105, 30, { align: 'center' });
  
  // Créer le tableau de projection
  const projectionTableData = [];
  
  // En-tête du tableau selon le mode de financement
  const headers = params.financingMode === 'cash' 
    ? ['Année', 'Production (kWh)', 'Économies (€)', 'Revente (€)', 'Gain annuel', 'Gain cumulé']
    : ['Année', 'Production (kWh)', 'Économies (€)', 'Revente (€)', 'Abonnement (€)', 'Gain annuel', 'Gain cumulé'];
  
  projectionTableData.push(headers);
  
  // Remplir les données de projection (limité à 20 ans)
  let cumulativeGain = 0;
  for (let i = 0; i < Math.min(20, projection.projectionAnnuelle.length); i++) {
    const year = projection.projectionAnnuelle[i];
    cumulativeGain += year.gainTotal;
    
    const row = [
      year.annee.toString(),
      Math.round(year.production).toString(),
      formatCurrency(year.economiesAutoconsommation),
      formatCurrency(year.revenusRevente)
    ];
    
    // Ajouter la colonne d'abonnement si nécessaire
    if (params.financingMode === 'subscription') {
      row.push(formatCurrency(-year.coutAbonnement));
    }
    
    // Ajouter les colonnes de gain
    row.push(formatCurrency(year.gainTotal));
    row.push(formatCurrency(cumulativeGain));
    
    projectionTableData.push(row);
  }
  
  // Générer le tableau
  autoTable(doc, {
    startY: 40,
    head: [projectionTableData[0]],
    body: projectionTableData.slice(1),
    theme: 'striped',
    styles: {
      fontSize: 8,
      cellPadding: 2
    },
    headStyles: {
      fillColor: [220, 230, 240],
      textColor: [40, 40, 40],
      fontStyle: 'bold'
    },
    columnStyles: {
      0: { cellWidth: 15 },
      1: { cellWidth: 25, halign: 'right' },
      2: { cellWidth: 25, halign: 'right' },
      3: { cellWidth: 25, halign: 'right' },
      4: { cellWidth: 25, halign: 'right' },
      5: { cellWidth: 25, halign: 'right' },
      6: { cellWidth: 25, halign: 'right' }
    }
  });
  
  // Ajouter une note sous le tableau
  const finalY5 = (doc as any).lastAutoTable.finalY;
  doc.setFontSize(8);
  doc.setTextColor(100, 100, 100);
  doc.text(
    'Note: Cette projection est basée sur les hypothèses actuelles et peut varier en fonction de l\'évolution des prix de l\'énergie.',
    105, 
    finalY5 + 10, 
    { align: 'center' }
  );
  
  // Sauvegarder la projection dans le localStorage pour le PDF-lib
  localStorage.setItem('financial_projection', JSON.stringify(projection));
  localStorage.setItem('battery_type', batteryInfo?.type || '');
  
  // Sauvegarder les informations d'abonnement pour le PDF-lib
  if (params.financingMode === 'subscription') {
    const monthlyPayment = params.dureeAbonnement ? projection.projectionAnnuelle[0].coutAbonnement / 12 : 0;
    localStorage.setItem('monthly_payment', monthlyPayment.toString());
    localStorage.setItem('subscription_duration', (params.dureeAbonnement || 20).toString());
    // Calculate deposit based only on subscription price, not including MyLight
    localStorage.setItem('subscription_deposit', (freeDeposit ? 0 : monthlyPayment * 2).toString());
  }
  
  // Ajouter un pied de page
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    doc.text(`Page ${i} sur ${pageCount}`, 105, doc.internal.pageSize.height - 10, { align: 'center' });
    doc.text('Document non contractuel - Simulation à titre indicatif', 105, doc.internal.pageSize.height - 5, { align: 'center' });
  }
  
  // Télécharger le PDF
  doc.save(`Simulation_Solaire_${clientInfo.nom}_${clientInfo.prenom}.pdf`);
}